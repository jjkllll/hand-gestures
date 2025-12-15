(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HandGestures = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  function palmCenter(points) {
    var ids = [0, 5, 9, 13, 17];
    var x = 0,
      y = 0;
    for (var i = 0; i < ids.length; i++) {
      x += points[ids[i]].x;
      y += points[ids[i]].y;
    }
    var n = ids.length;
    return { x: x / n, y: y / n };
  }
  function scaleRef(points) {
    var w = points[0];
    var m = points[9];
    var dx = w.x - m.x;
    var dy = w.y - m.y;
    return Math.hypot(dx, dy);
  }
  function extractFeatures(landmarks) {
    var c = palmCenter(landmarks);
    var s = Math.max(1e-4, scaleRef(landmarks));
    var feats = [];
    for (var i = 0; i < landmarks.length; i++) {
      var p = landmarks[i];
      feats.push((p.x - c.x) / s, (p.y - c.y) / s);
    }
    return feats;
  }
  function readFileText(handle, name) {
    return handle.getFileHandle(name, { create: false }).then(function (fh) {
      return fh.getFile().then(function (f) {
        return f.text();
      });
    });
  }
  function listJsonFiles(dir) {
    var out = [];
    return (async function () {
      try {
        for await (const [n, h] of dir.entries()) {
          if (h.kind === "file" && n.toLowerCase().endsWith(".json")) out.push(n);
        }
      } catch {}
      return out;
    })();
  }
  async function loadGesturesFromDirectory(root) {
    const byCode = new Map();
    const byName = new Map();
    for await (const [name, handle] of root.entries()) {
      if (handle.kind !== "directory") continue;
      const gDir = handle;
      let id = "";
      let gname = name;
      try {
        const metaText = await readFileText(gDir, "meta.json");
        const meta = JSON.parse(metaText);
        id = String(meta.id || "");
        gname = String(meta.name || name);
      } catch {}
      const code = md5(id + ":" + gname);
      let samples = [];
      try {
        const dataDir = await gDir.getDirectoryHandle("data", { create: false });
        const files = await listJsonFiles(dataDir);
        for (const fn of files) {
          try {
            const txt = await readFileText(dataDir, fn);
            const obj = JSON.parse(txt);
            const features = Array.isArray(obj.features) ? obj.features : [];
            const sampleHash = String(obj.sampleHash || "");
            samples.push({ id, name: gname, code, features, sampleHash, path: "data/" + fn });
          } catch {}
        }
      } catch {}
      byCode.set(code, { id, name: gname, code, samples });
      byName.set(gname, code);
    }
    return { byCode, byName };
  }
  function makeWeights(dim) {
    var w = new Array(dim).fill(1);
    var tipIdx = [4, 8, 12, 16, 20];
    for (var j = 0; j < tipIdx.length; j++) {
      var i = tipIdx[j];
      var xi = i * 2;
      var yi = xi + 1;
      if (xi < dim) w[xi] = 2;
      if (yi < dim) w[yi] = 2;
    }
    return w;
  }
  function meanVector(arrs, dim) {
    var m = new Array(dim).fill(0);
    for (var k = 0; k < arrs.length; k++) {
      var a = arrs[k];
      for (var i = 0; i < dim; i++) m[i] += a[i];
    }
    var n = arrs.length;
    for (var i = 0; i < dim; i++) m[i] /= Math.max(1, n);
    return m;
  }
  function weightedDistance(a, b, w) {
    var s = 0;
    var n = Math.min(a.length, b.length, w.length);
    for (var i = 0; i < n; i++) {
      var d = a[i] - b[i];
      s += w[i] * d * d;
    }
    return Math.sqrt(s) / n;
  }
  function buildCodebook(lib, weights, kFactor) {
    var entries = [];
    var dim = 0;
    for (const g of lib.byCode.values()) {
      if (g.samples.length === 0) continue;
      dim = g.samples[0].features.length;
      var feats = g.samples.map(s => s.features).filter(a => a.length === dim);
      if (feats.length === 0) continue;
      var mean = meanVector(feats, dim);
      var w = weights && weights.length === dim ? weights : makeWeights(dim);
      var dists = feats.map(f => weightedDistance(f, mean, w));
      var mu = dists.reduce((x, y) => x + y, 0) / dists.length;
      var sd = Math.sqrt(dists.reduce((x, y) => x + (y - mu) * (y - mu), 0) / Math.max(1, dists.length)) || 0.01;
      var th = mu + Math.max(0.05, (kFactor || 2) * sd);
      entries.push({ id: g.id, code: g.code, name: g.name, mean, threshold: th });
    }
    var w = weights && weights.length === (dim || 42) ? weights : makeWeights(dim || 42);
    return { entries, weights: w };
  }
  function matchWithCodebook(feats, cb) {
    var best = null;
    for (var i = 0; i < cb.entries.length; i++) {
      var e = cb.entries[i];
      var d = weightedDistance(feats, e.mean, cb.weights);
      if (!best || d < best.distance) best = { id: e.id, code: e.code, name: e.name, distance: d };
    }
    if (!best) return null;
    var entry = cb.entries.find(x => x.code === best.code);
    if (!entry) return null;
    if (best.distance <= entry.threshold) return best;
    return null;
  }
  function md5(str) {
    // lightweight md5 placeholder for code derivation; for production replace with a full md5
    var hash = 0,
      i,
      chr;
    for (i = 0; i < str.length; i++) {
      chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    return String(hash);
  }
  function GestureRecognizer() {
    this.lib = null;
    this.threshold = 0.8;
    this.callbacks = {};
    this.codebook = null;
    this.lastCode = "";
    this.streak = 0;
    this.minStreak = 3;
    this.mode = "codebook";
    this.k = 3;
    this.windowSize = 1;
    this.buffer = [];
  }
  GestureRecognizer.prototype.setLibrary = function (lib) {
    this.lib = lib;
    this.codebook = buildCodebook(lib);
    this.lastCode = "";
    this.streak = 0;
  };
  GestureRecognizer.prototype.setThreshold = function (t) {
    this.threshold = t;
  };
  GestureRecognizer.prototype.setMode = function (m) {
    this.mode = m;
  };
  GestureRecognizer.prototype.setK = function (k) {
    this.k = k;
  };
  GestureRecognizer.prototype.setWindowSize = function (n) {
    this.windowSize = Math.max(1, n);
    this.buffer = [];
  };
  GestureRecognizer.prototype.on = function (code, fn) {
    this.callbacks[code] = fn;
  };
  GestureRecognizer.prototype.recognizeFromLandmarks = function (landmarks) {
    if (!this.lib || !landmarks || landmarks.length < 21) return null;
    var cur = extractFeatures(landmarks);
    var feats = cur;
    if (this.windowSize > 1) {
      this.buffer.push(cur);
      if (this.buffer.length > this.windowSize) this.buffer.shift();
      if (this.buffer.length === this.windowSize) {
        feats = new Array(cur.length).fill(0);
        for (var b = 0; b < this.buffer.length; b++) {
          var a = this.buffer[b];
          for (var i = 0; i < feats.length; i++) feats[i] += a[i];
        }
        for (var i = 0; i < feats.length; i++) feats[i] /= this.buffer.length;
      }
    }
    var res = null;
    if (this.mode === "codebook" && this.codebook) {
      res = matchWithCodebook(feats, this.codebook);
    }
    if (!res) {
      res = null;
      // fallback simple nearest neighbor
      var bestCode = "";
      var bestId = "";
      var bestName = "";
      var bestDist = Number.POSITIVE_INFINITY;
      for (const g of this.lib.byCode.values()) {
        for (const s of g.samples) {
          if (s.features.length !== feats.length) continue;
          var sum = 0;
          for (var i = 0; i < feats.length; i++) {
            var d = feats[i] - s.features[i];
            sum += d * d;
          }
          var dist = Math.sqrt(sum) / feats.length;
          if (dist < bestDist) {
            bestDist = dist;
            bestCode = g.code;
            bestId = g.id;
            bestName = g.name;
          }
        }
      }
      if (bestCode && bestDist <= this.threshold) {
        res = { id: bestId, code: bestCode, name: bestName, distance: bestDist };
      }
    }
    if (res) {
      if (res.code === this.lastCode) {
        this.streak++;
      } else {
        this.lastCode = res.code;
        this.streak = 1;
      }
      if (this.streak >= this.minStreak) {
        var cb = this.callbacks[res.code];
        if (cb) cb(res);
        return res;
      }
      return null;
    }
    return res;
  };
  return {
    loadFromDirectory: loadGesturesFromDirectory,
    createRecognizer: function (lib, opts) {
      var r = new GestureRecognizer();
      r.setLibrary(lib);
      if (opts && typeof opts.threshold === "number") r.setThreshold(opts.threshold);
      if (opts && typeof opts.mode === "string") r.setMode(opts.mode);
      if (opts && typeof opts.k === "number") r.setK(opts.k);
      if (opts && typeof opts.windowSize === "number") r.setWindowSize(opts.windowSize);
      return r;
    },
    extractFeatures: extractFeatures
  };
});

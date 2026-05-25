window.HELP_IMPROVE_VIDEOJS = false;

function revitReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

var INTERP_BASE = "./static/interpolation/stacked";
var NUM_INTERP_FRAMES = 240;

var interp_images = [];
function preloadInterpolationImages() {
  for (var i = 0; i < NUM_INTERP_FRAMES; i++) {
    var path = INTERP_BASE + '/' + String(i).padStart(6, '0') + '.jpg';
    interp_images[i] = new Image();
    interp_images[i].src = path;
  }
}

function setInterpolationImage(i) {
  var image = interp_images[i];
  image.ondragstart = function() { return false; };
  image.oncontextmenu = function() { return false; };
  $('#interpolation-image-wrapper').empty().append(image);
}


revitReady(function() {
    if (!window.jQuery) {
      initAOVRebaseDemo();
      initShiftWindowDemo();
      return;
    }
    // Check for click events on the navbar burger icon
    $(".navbar-burger").click(function() {
      // Toggle the "is-active" class on both the "navbar-burger" and the "navbar-menu"
      $(".navbar-burger").toggleClass("is-active");
      $(".navbar-menu").toggleClass("is-active");

    });

    var options = {
			slidesToScroll: 1,
			slidesToShow: 3,
			loop: true,
			infinite: true,
			autoplay: false,
			autoplaySpeed: 3000,
    }

		// Initialize all div with carousel class
    var carousels = bulmaCarousel.attach('.carousel', options);

    // Loop on each carousel initialized
    for(var i = 0; i < carousels.length; i++) {
    	// Add listener to  event
    	carousels[i].on('before:show', state => {
    		console.log(state);
    	});
    }

    // Access to bulmaCarousel instance of an element
    var element = document.querySelector('#my-element');
    if (element && element.bulmaCarousel) {
    	// bulmaCarousel instance is available as element.bulmaCarousel
    	element.bulmaCarousel.on('before-show', function(state) {
    		console.log(state);
    	});
    }

    /*var player = document.getElementById('interpolation-video');
    player.addEventListener('loadedmetadata', function() {
      $('#interpolation-slider').on('input', function(event) {
        console.log(this.value, player.duration);
        player.currentTime = player.duration / 100 * this.value;
      })
    }, false);*/
    preloadInterpolationImages();

    $('#interpolation-slider').on('input', function(event) {
      setInterpolationImage(this.value);
    });
    setInterpolationImage(0);
    $('#interpolation-slider').prop('max', NUM_INTERP_FRAMES - 1);

    bulmaSlider.attach();
    initAOVRebaseDemo();
    initShiftWindowDemo();

})


function initAOVRebaseDemo() {
  var globalCanvas = document.getElementById('aov-global-canvas');
  if (!globalCanvas) {
    return;
  }

  var canvases = {
    global: globalCanvas,
    local: document.getElementById('aov-local-canvas'),
    spatial: document.getElementById('aov-stage-spatial'),
    sequence: document.getElementById('aov-stage-sequence'),
    basis: document.getElementById('aov-stage-basis'),
    rebased: document.getElementById('aov-stage-rebased')
  };
  var slider = document.getElementById('aov-angle');
  var output = document.getElementById('aov-angle-output');
  var localBasisLabel = document.getElementById('aov-local-basis-label');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.rebase-angle'));
  var state = { angle: 0 };
  var gridN = 4;
  var selected = { row: 1, col: 2 };
  var samples = [
    { x: -0.24, y: -0.24 },
    { x: 0.0, y: -0.24 },
    { x: 0.24, y: -0.24 },
    { x: -0.24, y: 0.0 },
    { x: 0.0, y: 0.0 },
    { x: 0.24, y: 0.0 },
    { x: -0.24, y: 0.24 },
    { x: 0.0, y: 0.24 },
    { x: 0.24, y: 0.24 }
  ];
  var palette = {
    ink: '#172a3a',
    muted: '#5d7183',
    grid: '#d9e3ec',
    panel: '#fbfcfe',
    vector: '#e2663a',
    vectorSoft: '#f0a17f',
    b1: '#cf3f35',
    b2: '#2369a8',
    local: '#15866f',
    localSoft: '#8cc8ba',
    mark: '#b82e2e'
  };

  function canvasBox(canvas) {
    var rect = canvas.getBoundingClientRect();
    var width = rect.width || 320;
    var height = rect.height || width * 0.75;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pixelWidth = Math.max(1, Math.round(width * dpr));
    var pixelHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx: ctx, width: width, height: height };
  }

  function rotate(v, radians) {
    var c = Math.cos(radians);
    var s = Math.sin(radians);
    return { x: c * v.x - s * v.y, y: s * v.x + c * v.y };
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y;
  }

  function normalize(v) {
    var len = Math.sqrt(v.x * v.x + v.y * v.y);
    if (len < 1e-8) {
      return { x: 1, y: 0, len: 0 };
    }
    return { x: v.x / len, y: v.y / len, len: len };
  }

  function basisFromAverage(avg) {
    var b1 = normalize(avg);
    return {
      b1: { x: b1.x, y: b1.y },
      b2: { x: -b1.y, y: b1.x },
      speed: b1.len
    };
  }

  function localize(basis, vector) {
    return {
      x: dot(basis.b1, vector),
      y: dot(basis.b2, vector)
    };
  }

  function gridPosition(row, col) {
    return {
      x: col - (gridN - 1) / 2,
      y: (gridN - 1) / 2 - row
    };
  }

  function averageVector(row, col) {
    var p = gridPosition(row, col);
    return {
      x: 0.62 + 0.16 * p.y + 0.06 * Math.sin((row + 1) * 1.35),
      y: 0.18 - 0.22 * p.x + 0.07 * Math.cos((col + 1) * 1.1)
    };
  }

  function sampleVector(row, col, sample) {
    var avg = averageVector(row, col);
    var twist = 0.34;
    var shear = 0.16 * Math.sin((row + 1.4) * (col + 0.7));
    return {
      x: avg.x - twist * sample.y + shear * sample.x + 0.055 * Math.sin((row + 1) * (sample.x + 1.6)),
      y: avg.y + twist * sample.x - shear * sample.y + 0.055 * Math.cos((col + 1) * (sample.y + 1.4))
    };
  }

  function representativeSample(row, col) {
    return samples[(row * 3 + col * 5) % samples.length];
  }

  function vectorFromLocalComponents(basis, local) {
    return {
      x: basis.b1.x * local.x + basis.b2.x * local.y,
      y: basis.b1.y * local.x + basis.b2.y * local.y
    };
  }

  function displayPatchVector(row, col) {
    var basis = basisFromAverage(averageVector(row, col));
    var phase = row * gridN + col;
    var angles = [-0.72, -0.48, -0.24, -0.04, 0.18, 0.42, 0.64, -0.62];
    var angle = angles[phase % angles.length] + 0.07 * Math.sin(row * 1.7 + col * 0.9);
    var magnitude = 0.58 + 0.12 * ((phase * 5) % 7) / 6;
    return vectorFromLocalComponents(basis, {
      x: magnitude * Math.cos(angle),
      y: magnitude * Math.sin(angle)
    });
  }

  function mapPoint(point, width, height, scale) {
    return {
      x: width / 2 + point.x * scale,
      y: height / 2 - point.y * scale
    };
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    var r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawArrow(ctx, x1, y1, x2, y2, color, width, headSize) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) {
      return;
    }
    var angle = Math.atan2(dy, dx);
    var head = headSize || 8;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width || 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCanvasLabel(ctx, text, x, y, color, align) {
    ctx.save();
    ctx.fillStyle = color || palette.muted;
    ctx.font = '700 12px "Noto Sans", sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function paintCanvasBase(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = palette.panel;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#eef3f7';
    ctx.lineWidth = 1;
    for (var x = 24; x < width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (var y = 24; y < height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFixedAxes(ctx, width, height) {
    var ox = 38;
    var oy = height - 34;
    drawArrow(ctx, ox, oy, ox + 52, oy, '#91a3b2', 1.8, 6);
    drawArrow(ctx, ox, oy, ox, oy - 52, '#91a3b2', 1.8, 6);
    drawCanvasLabel(ctx, 'X', ox + 62, oy, '#718293');
    drawCanvasLabel(ctx, 'Y', ox, oy - 62, '#718293', 'center');
  }

  function drawRotatedCell(ctx, center, radians, scale, fill, stroke, lineWidth) {
    var half = 0.44;
    var corners = [
      { x: center.x - half, y: center.y - half },
      { x: center.x + half, y: center.y - half },
      { x: center.x + half, y: center.y + half },
      { x: center.x - half, y: center.y + half }
    ];
    ctx.beginPath();
    for (var i = 0; i < corners.length; i++) {
      var p = mapPoint(rotate(corners[i], radians), ctx.canvas.clientWidth, ctx.canvas.clientHeight, scale);
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke || palette.grid;
    ctx.lineWidth = lineWidth || 1;
    ctx.stroke();
  }

  function drawRotatedPatchGrid(ctx, width, height, radians, scale) {
    for (var row = 0; row < gridN; row++) {
      for (var col = 0; col < gridN; col++) {
        var center = gridPosition(row, col);
        var isSelected = row === selected.row && col === selected.col;
        drawRotatedCell(ctx, center, radians, scale, isSelected ? '#fff3ef' : '#ffffff', isSelected ? palette.mark : palette.grid, isSelected ? 2.4 : 1);
      }
    }
  }

  function drawPatchVectors(ctx, width, height, radians, scale, mode) {
    for (var row = 0; row < gridN; row++) {
      for (var col = 0; col < gridN; col++) {
        var baseCenter = gridPosition(row, col);
        var screenCenter = mapPoint(rotate(baseCenter, radians), width, height, scale);
        var avg = averageVector(row, col);
        var rawVector = displayPatchVector(row, col);
        var vector;
        if (mode === 'global') {
          vector = rotate(rawVector, radians);
        } else {
          vector = localize(basisFromAverage(avg), rawVector);
        }
        drawArrow(ctx, screenCenter.x, screenCenter.y, screenCenter.x + vector.x * scale * 0.45, screenCenter.y - vector.y * scale * 0.45, mode === 'global' ? palette.vector : palette.local, 2.2, 7);
      }
    }
  }

  function drawSelectedSamples(ctx, width, height, radians, scale, mode) {
    var selectedCenter = gridPosition(selected.row, selected.col);
    var basis = basisFromAverage(averageVector(selected.row, selected.col));
    samples.forEach(function(sample) {
      var localPoint = { x: selectedCenter.x + sample.x, y: selectedCenter.y + sample.y };
      var rotatedPoint = mapPoint(rotate(localPoint, radians), width, height, scale);
      var rawVector = sampleVector(selected.row, selected.col, sample);
      var vector = mode === 'global' ? rotate(rawVector, radians) : localize(basis, rawVector);
      drawArrow(ctx, rotatedPoint.x, rotatedPoint.y, rotatedPoint.x + vector.x * scale * 0.22, rotatedPoint.y - vector.y * scale * 0.22, mode === 'global' ? palette.vectorSoft : palette.localSoft, 1.6, 5);
    });
  }

  function drawFixedGlobalBasis(ctx, width, height, radians, scale) {
    var selectedCenter = gridPosition(selected.row, selected.col);
    var selectedScreen = mapPoint(rotate(selectedCenter, radians), width, height, scale);
    drawArrow(ctx, selectedScreen.x, selectedScreen.y, selectedScreen.x + scale * 0.62, selectedScreen.y, '#7e8c98', 3, 9);
    drawArrow(ctx, selectedScreen.x, selectedScreen.y, selectedScreen.x, selectedScreen.y - scale * 0.62, '#7e8c98', 3, 9);
    drawCanvasLabel(ctx, 'b1 = X', selectedScreen.x + scale * 0.74, selectedScreen.y + 12, '#6d7b87', 'center');
    drawCanvasLabel(ctx, 'b2 = Y', selectedScreen.x + 20, selectedScreen.y - scale * 0.72, '#6d7b87', 'left');
  }

  function drawCoRotatedAOVBasis(ctx, width, height, radians, scale) {
    var selectedCenter = gridPosition(selected.row, selected.col);
    var selectedScreen = mapPoint(rotate(selectedCenter, radians), width, height, scale);
    var basis = basisFromAverage(averageVector(selected.row, selected.col));
    var rb1 = rotate(basis.b1, radians);
    var rb2 = rotate(basis.b2, radians);
    drawArrow(ctx, selectedScreen.x, selectedScreen.y, selectedScreen.x + rb1.x * scale * 0.7, selectedScreen.y - rb1.y * scale * 0.7, palette.b1, 3, 9);
    drawArrow(ctx, selectedScreen.x, selectedScreen.y, selectedScreen.x + rb2.x * scale * 0.58, selectedScreen.y - rb2.y * scale * 0.58, palette.b2, 3, 9);
    drawCanvasLabel(ctx, 'b1', selectedScreen.x + rb1.x * scale * 0.82, selectedScreen.y - rb1.y * scale * 0.82, palette.b1, 'center');
    drawCanvasLabel(ctx, 'b2', selectedScreen.x + rb2.x * scale * 0.72, selectedScreen.y - rb2.y * scale * 0.72, palette.b2, 'center');
  }

  function drawFieldPanel(canvas, mode) {
    var box = canvasBox(canvas);
    var ctx = box.ctx;
    var width = box.width;
    var height = box.height;
    var radians = state.angle * Math.PI / 180;
    var scale = Math.min(width, height) / 4.9;
    paintCanvasBase(ctx, width, height);
    drawFixedAxes(ctx, width, height);
    drawRotatedPatchGrid(ctx, width, height, radians, scale);
    drawPatchVectors(ctx, width, height, radians, scale, mode);
    drawSelectedSamples(ctx, width, height, radians, scale, mode);

    if (mode === 'global') {
      drawFixedGlobalBasis(ctx, width, height, radians, scale);
      drawCanvasLabel(ctx, 'global vectors in fixed X-Y basis', 18, 22, palette.ink);
    } else {
      drawCoRotatedAOVBasis(ctx, width, height, radians, scale);
      drawCanvasLabel(ctx, 'rebased vectors in co-rotating local basis', 18, 22, palette.ink);
    }
  }

  function drawGlobalField() {
    drawFieldPanel(canvases.global, 'global');
  }

  function drawLocalFrame() {
    drawFieldPanel(canvases.local, 'rebased');
  }

  function drawComponentBar(ctx, x, y, width, value, label, color) {
    var maxValue = 1.05;
    var center = x + width / 2;
    ctx.save();
    ctx.strokeStyle = '#dce4ec';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 18);
    ctx.lineTo(x + width, y + 18);
    ctx.stroke();
    ctx.fillStyle = color;
    var barWidth = Math.max(2, Math.min(width / 2, Math.abs(value) / maxValue * width / 2));
    roundedRect(ctx, value >= 0 ? center : center - barWidth, y + 9, barWidth, 18, 5);
    ctx.fill();
    ctx.fillStyle = palette.muted;
    ctx.font = '700 11px "Noto Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y);
    ctx.textAlign = 'right';
    ctx.fillText(value.toFixed(2), x + width, y);
    ctx.restore();
  }

  function stagePatchOrder() {
    return [0, 2, 5, selected.row * gridN + selected.col, 7, 10, 13, 15];
  }

  function drawPatchCard(ctx, x, y, size, row, col, highlightSelected) {
    var isSelected = highlightSelected !== false && row === selected.row && col === selected.col;
    roundedRect(ctx, x, y, size, size, 5);
    ctx.fillStyle = isSelected ? '#fff3ef' : '#ffffff';
    ctx.fill();
    ctx.strokeStyle = isSelected ? palette.mark : palette.grid;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();
    return { x: x + size / 2, y: y + size / 2, selected: isSelected };
  }

  function drawStageGlobalField() {
    var box = canvasBox(canvases.spatial);
    var ctx = box.ctx;
    var width = box.width;
    var height = box.height;
    var radians = state.angle * Math.PI / 180;
    var scale = Math.min(width, height) / 5.15;
    paintCanvasBase(ctx, width, height);
    for (var row = 0; row < gridN; row++) {
      for (var col = 0; col < gridN; col++) {
        drawRotatedCell(ctx, gridPosition(row, col), radians, scale, '#ffffff', palette.grid, 1);
      }
    }
    drawPatchVectors(ctx, width, height, radians, scale, 'global');
  }

  function drawStageSequence(canvas, mode) {
    var box = canvasBox(canvas);
    var ctx = box.ctx;
    var width = box.width;
    var height = box.height;
    var radians = state.angle * Math.PI / 180;
    var order = stagePatchOrder();
    var patch = Math.min(width, height) * 0.24;
    var stepX = patch * 0.72;
    var stepY = patch * 0.46;
    var startX = width * 0.08;
    var startY = height * 0.08;
    paintCanvasBase(ctx, width, height);

    for (var i = order.length - 1; i >= 0; i--) {
      var index = order[i];
      var row = Math.floor(index / gridN);
      var col = index % gridN;
      var x = startX + i * stepX;
      var y = startY + i * stepY;
      var center = drawPatchCard(ctx, x, y, patch, row, col, true);
      var basis = basisFromAverage(averageVector(row, col));
      var rawVector = displayPatchVector(row, col);
      var vector = mode === 'global' ? rotate(rawVector, radians) : localize(basis, rawVector);
      drawArrow(ctx, center.x, center.y, center.x + vector.x * patch * 0.34, center.y - vector.y * patch * 0.34, mode === 'global' ? palette.vector : palette.local, center.selected ? 2.2 : 1.7, center.selected ? 7 : 5);
    }
  }

  function drawStageLocalBasis() {
    var box = canvasBox(canvases.basis);
    var ctx = box.ctx;
    var width = box.width;
    var height = box.height;
    var radians = state.angle * Math.PI / 180;
    var order = stagePatchOrder();
    var patch = Math.min(width, height) * 0.24;
    var stepX = patch * 0.72;
    var stepY = patch * 0.46;
    var startX = width * 0.08;
    var startY = height * 0.08;
    paintCanvasBase(ctx, width, height);

    for (var i = order.length - 1; i >= 0; i--) {
      var index = order[i];
      var row = Math.floor(index / gridN);
      var col = index % gridN;
      var x = startX + i * stepX;
      var y = startY + i * stepY;
      var center = drawPatchCard(ctx, x, y, patch, row, col, true);
      var basis = basisFromAverage(averageVector(row, col));
      var rb1 = rotate(basis.b1, radians);
      var rb2 = rotate(basis.b2, radians);
      drawArrow(ctx, center.x, center.y, center.x + rb1.x * patch * 0.35, center.y - rb1.y * patch * 0.35, palette.b1, center.selected ? 2.1 : 1.6, center.selected ? 7 : 5);
      drawArrow(ctx, center.x, center.y, center.x + rb2.x * patch * 0.3, center.y - rb2.y * patch * 0.3, palette.b2, center.selected ? 2.1 : 1.6, center.selected ? 7 : 5);
    }
  }

  function drawStageRebasedSequence() {
    drawStageSequence(canvases.rebased, 'rebased');
  }

  function render() {
    drawGlobalField();
    drawLocalFrame();
    drawStageGlobalField();
    drawStageSequence(canvases.sequence, 'global');
    drawStageLocalBasis();
    drawStageRebasedSequence();
    if (localBasisLabel) {
      localBasisLabel.textContent = 'local basis';
    }
  }

  function setAngle(angle) {
    state.angle = Math.max(0, Math.min(270, Number(angle) || 0));
    slider.value = String(state.angle);
    output.innerHTML = Math.round(state.angle) + '&deg;';
    buttons.forEach(function(button) {
      button.classList.toggle('is-active', Number(button.dataset.angle) === Math.round(state.angle));
    });
    render();
  }

  buttons.forEach(function(button) {
    button.addEventListener('click', function() {
      setAngle(button.dataset.angle);
    });
  });

  slider.addEventListener('input', function() {
    setAngle(slider.value);
  });

  var resizeTimer = null;
  window.addEventListener('resize', function() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(render, 80);
  });

  setAngle(0);
}


function initShiftWindowDemo() {
  var root = document.getElementById('shift-window-demo');
  if (!root) {
    return;
  }

  var normalCanvas = document.getElementById('shift-normal-canvas');
  var rotatedCanvas = document.getElementById('shift-rotated-canvas');
  if (!normalCanvas || !rotatedCanvas) {
    return;
  }

  var rotationButtons = Array.prototype.slice.call(root.querySelectorAll('[data-rotation]'));
  var stageButtons = Array.prototype.slice.call(root.querySelectorAll('[data-stage]'));
  var normalCaption = document.getElementById('shift-normal-caption');
  var rotatedCaption = document.getElementById('shift-rotated-caption');
  var rotatedTitle = document.getElementById('shift-rotated-title');
  var stageNote = document.getElementById('shift-stage-note');
  var invarianceStatus = document.getElementById('shift-window-invariance');
  var trackedWindowStatus = document.getElementById('shift-tracked-window');

  var state = {
    rotation: 90,
    stage: 'input'
  };

  var trackedValues = [36, 37, 44, 45];
  var trackedMap = trackedValues.reduce(function(map, value) {
    map[value] = true;
    return map;
  }, {});
  var sourceWindowColors = ['#bdd7ee', '#f8cbad', '#c6e0b4', '#e2d5e7'];
  var palette = {
    ink: '#172a3a',
    muted: '#607385',
    grid: '#ffffff',
    cellStroke: '#ffffff',
    window: '#bc332b',
    highlight: '#18a957',
    shadow: 'rgba(23, 42, 58, 0.12)'
  };

  var stageMeta = {
    input: {
      caption: 'Input 8x8',
      windowSize: 4,
      note: 'Stage 1 — Input 8x8. The 64 tokens sit in their original layout; red lines mark the four 4x4 windows the first attention block will operate over. Because attention is permutation-equivariant within each window, only the per-window token set matters — and each rotated window holds exactly the rotated counterpart of a normal window.'
    },
    shiftedInput: {
      caption: 'Shift 8x8',
      windowSize: 4,
      note: 'Stage 2 — Shift 8x8. A cyclic roll by half a window (−2, −2) reslices the same 64 tokens into four new 4x4 windows. This is the shifted-window partition: attention here mixes tokens that were kept apart in stage 1. The roll is applied identically in both lanes; the new per-window token sets still agree.'
    },
    shiftedBackInput: {
      caption: 'Shift back 8x8',
      windowSize: 4,
      note: 'Stage 3 — Shift back 8x8. The inverse cyclic roll (+2, +2) undoes stage 2 so the next operation sees the canonical W-MSA frame. The grid looks identical to stage 1 because roll(+s)∘roll(−s) is the identity at the token level. This is a distinct pipeline moment, separate from the patch-merge that follows.'
    },
    merged: {
      caption: 'Merge → 4x4',
      windowSize: 2,
      note: 'Stage 4 — Patch merge → 4x4. Each unshifted 2x2 source patch is collapsed into one 4-tuple token; the grid is now 4x4 with four 2x2 windows. Merge is a standalone operation that lives between blocks — it is not part of the shift/shift-back cycle. Every merged cell prints the four source identities it carries. Window sets still match across lanes.'
    },
    shiftedMerge: {
      caption: 'Shift 4x4',
      windowSize: 2,
      note: 'Stage 5 — Shift 4x4. A cyclic roll by 1 on the 4x4 grid reslices the merged tokens into four new 2x2 windows for the SW-MSA-style partition at the coarser scale. Same invariant as stage 2: the per-window token sets agree between normal and rotated lanes.'
    },
    shiftedBackMerge: {
      caption: 'Shift back 4x4',
      windowSize: 2,
      note: 'Stage 6 — Shift back 4x4. The inverse cyclic roll (+1, +1) returns the merged tokens to the canonical W-MSA frame at 4x4. The grid is identical to stage 4 cell-by-cell, but it sits at a different pipeline moment: the model is now ready to hand off to patch expand.'
    },
    expanded: {
      caption: 'Expand → 8x8',
      windowSize: 4,
      note: 'Stage 7 — Patch expand → 8x8. Each 4-tuple unfolds back into a 2x2 patch. Identity-merge composed with identity-expand puts every token back to its stage-1 position, so the whole shifted-window pipeline is identity at the token level. Expand is again standalone — separate from the shift/shift-back cycle above.'
    }
  };

  function makeBaseGrid() {
    var grid = [];
    for (var r = 0; r < 8; r++) {
      var row = [];
      for (var c = 0; c < 8; c++) {
        row.push(r * 8 + c);
      }
      grid.push(row);
    }
    return grid;
  }

  var baseGrid = makeBaseGrid();

  function mod(value, size) {
    return ((value % size) + size) % size;
  }

  function rotateGridOnce(grid) {
    var rows = grid.length;
    var cols = grid[0].length;
    var out = [];
    for (var r = 0; r < cols; r++) {
      var row = [];
      for (var c = 0; c < rows; c++) {
        row.push(grid[c][cols - 1 - r]);
      }
      out.push(row);
    }
    return out;
  }

  function rotateGrid(grid, turns) {
    var out = grid;
    var count = mod(turns, 4);
    for (var i = 0; i < count; i++) {
      out = rotateGridOnce(out);
    }
    return out;
  }

  function rollGrid(grid, rowShift, colShift) {
    var rows = grid.length;
    var cols = grid[0].length;
    var out = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) {
        row.push(grid[mod(r - rowShift, rows)][mod(c - colShift, cols)]);
      }
      out.push(row);
    }
    return out;
  }

  function downsample(grid) {
    var out = [];
    for (var r = 0; r < grid.length / 2; r++) {
      var row = [];
      for (var c = 0; c < grid[0].length / 2; c++) {
        row.push([
          grid[2 * r][2 * c],
          grid[2 * r + 1][2 * c],
          grid[2 * r][2 * c + 1],
          grid[2 * r + 1][2 * c + 1]
        ]);
      }
      out.push(row);
    }
    return out;
  }

  function expand(grid, rowsOut, colsOut) {
    var out = [];
    for (var r = 0; r < rowsOut; r++) {
      var row = [];
      for (var c = 0; c < colsOut; c++) {
        var coarseR = Math.min(Math.floor(r / 2), grid.length - 1);
        var coarseC = Math.min(Math.floor(c / 2), grid[0].length - 1);
        var tupleIndex = (r % 2) + (c % 2) * 2;
        row.push(grid[coarseR][coarseC][tupleIndex]);
      }
      out.push(row);
    }
    return out;
  }

  function buildLane(turns) {
    var input = rotateGrid(baseGrid, turns);
    var shiftedInput = rollGrid(input, -2, -2);
    var shiftedBackInput = rollGrid(shiftedInput, 2, 2);
    var merged = downsample(shiftedBackInput);
    var shiftedMerge = rollGrid(merged, -1, -1);
    var shiftedBackMerge = rollGrid(shiftedMerge, 1, 1);
    return {
      input: input,
      shiftedInput: shiftedInput,
      shiftedBackInput: shiftedBackInput,
      merged: merged,
      shiftedMerge: shiftedMerge,
      shiftedBackMerge: shiftedBackMerge,
      expanded: expand(shiftedBackMerge, 8, 8)
    };
  }

  function partitionIntoWindows(grid, windowSize) {
    var rows = grid.length;
    var cols = grid[0].length;
    var windows = [];
    for (var wr = 0; wr < rows; wr += windowSize) {
      for (var wc = 0; wc < cols; wc += windowSize) {
        var tokens = [];
        var has = {};
        for (var r = wr; r < wr + windowSize; r++) {
          for (var c = wc; c < wc + windowSize; c++) {
            var values = cellValues(grid[r][c]);
            for (var k = 0; k < values.length; k++) {
              tokens.push(values[k]);
              if (trackedMap[values[k]]) {
                has.tracked = true;
              }
            }
          }
        }
        tokens.sort(function(a, b) { return a - b; });
        windows.push({ tokens: tokens, hasTracked: !!has.tracked, row: wr / windowSize, col: wc / windowSize });
      }
    }
    return windows;
  }

  function windowSetsMatch(gridA, gridB, windowSize) {
    var wa = partitionIntoWindows(gridA, windowSize);
    var wb = partitionIntoWindows(gridB, windowSize);
    if (wa.length !== wb.length) {
      return false;
    }
    var keyA = wa.map(function(w) { return w.tokens.join(','); }).sort();
    var keyB = wb.map(function(w) { return w.tokens.join(','); }).sort();
    for (var i = 0; i < keyA.length; i++) {
      if (keyA[i] !== keyB[i]) {
        return false;
      }
    }
    return true;
  }

  function describeTrackedWindow(grid, windowSize) {
    var windows = partitionIntoWindows(grid, windowSize);
    var grid_windows_per_row = Math.round(grid.length / windowSize);
    var labels = [];
    for (var i = 0; i < windows.length; i++) {
      if (windows[i].hasTracked) {
        var rr = windows[i].row;
        var cc = windows[i].col;
        labels.push('window (' + rr + ',' + cc + ')');
      }
    }
    if (labels.length === 0) {
      return 'no window';
    }
    return labels.join(' & ');
  }

  function canvasBox(canvas) {
    var rect = canvas.getBoundingClientRect();
    var width = rect.width || 360;
    var height = rect.height || width * 0.75;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pixelWidth = Math.max(1, Math.round(width * dpr));
    var pixelHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx: ctx, width: width, height: height };
  }

  function colorForValue(value) {
    var row = Math.floor(value / 8);
    var col = value % 8;
    var windowRow = Math.floor(row / 4);
    var windowCol = Math.floor(col / 4);
    return sourceWindowColors[windowRow * 2 + windowCol];
  }

  function cellValues(cell) {
    return Array.isArray(cell) ? cell : [cell];
  }

  function cellHasTrackedValue(cell) {
    var values = cellValues(cell);
    for (var i = 0; i < values.length; i++) {
      if (trackedMap[values[i]]) {
        return true;
      }
    }
    return false;
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    var r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawCellText(ctx, cell, x, y, size) {
    ctx.fillStyle = '#111820';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (Array.isArray(cell)) {
      var fontSize = Math.max(8, Math.min(13, size * 0.18));
      ctx.font = '800 ' + fontSize + 'px "Noto Sans", sans-serif';
      ctx.fillText(cell[0] + ',' + cell[2], x + size / 2, y + size * 0.39);
      ctx.fillText(cell[1] + ',' + cell[3], x + size / 2, y + size * 0.62);
    } else {
      var singleFont = Math.max(9, Math.min(14, size * 0.36));
      ctx.font = '800 ' + singleFont + 'px "Noto Sans", sans-serif';
      ctx.fillText(String(cell), x + size / 2, y + size / 2);
    }
  }

  function drawWindowLines(ctx, x, y, gridSize, cellSize, windowSize) {
    ctx.save();
    ctx.strokeStyle = palette.window;
    ctx.lineWidth = Math.max(2, cellSize * 0.05);
    for (var i = 0; i <= gridSize; i += windowSize) {
      ctx.beginPath();
      ctx.moveTo(x + i * cellSize, y);
      ctx.lineTo(x + i * cellSize, y + gridSize * cellSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + i * cellSize);
      ctx.lineTo(x + gridSize * cellSize, y + i * cellSize);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGrid(canvas, grid, meta, laneLabel) {
    var box = canvasBox(canvas);
    var ctx = box.ctx;
    var width = box.width;
    var height = box.height;
    var gridSize = grid.length;
    var topLabel = 24;
    var pad = 18;
    var available = Math.min(width - pad * 2, height - topLabel - pad * 1.4);
    var cellSize = available / gridSize;
    var gridPixels = cellSize * gridSize;
    var startX = (width - gridPixels) / 2;
    var startY = topLabel + (height - topLabel - gridPixels) / 2;

    ctx.save();
    ctx.fillStyle = '#fbfcfe';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = palette.muted;
    ctx.font = '800 12px "Noto Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(laneLabel, 16, 16);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = palette.shadow;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    drawRoundedRect(ctx, startX - 1, startY - 1, gridPixels + 2, gridPixels + 2, 7);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    for (var r = 0; r < gridSize; r++) {
      for (var c = 0; c < gridSize; c++) {
        var cell = grid[r][c];
        var values = cellValues(cell);
        ctx.fillStyle = colorForValue(values[0]);
        ctx.fillRect(startX + c * cellSize, startY + r * cellSize, cellSize, cellSize);
        ctx.strokeStyle = palette.cellStroke;
        ctx.lineWidth = 1;
        ctx.strokeRect(startX + c * cellSize, startY + r * cellSize, cellSize, cellSize);
      }
    }

    for (var tr = 0; tr < gridSize; tr++) {
      for (var tc = 0; tc < gridSize; tc++) {
        var x = startX + tc * cellSize;
        var y = startY + tr * cellSize;
        drawCellText(ctx, grid[tr][tc], x, y, cellSize);
        if (cellHasTrackedValue(grid[tr][tc])) {
          ctx.save();
          ctx.strokeStyle = palette.highlight;
          ctx.lineWidth = Math.max(3, cellSize * 0.08);
          ctx.strokeRect(x + cellSize * 0.1, y + cellSize * 0.1, cellSize * 0.8, cellSize * 0.8);
          ctx.restore();
        }
      }
    }

    drawWindowLines(ctx, startX, startY, gridSize, cellSize, meta.windowSize);
  }

  function render() {
    var turns = state.rotation / 90;
    var normalLane = buildLane(0);
    var rotatedLane = buildLane(turns);
    var meta = stageMeta[state.stage];
    drawGrid(normalCanvas, normalLane[state.stage], meta, 'normal lane');
    drawGrid(rotatedCanvas, rotatedLane[state.stage], meta, state.rotation + ' deg lane');

    if (normalCaption) {
      normalCaption.textContent = meta.caption;
    }
    if (rotatedCaption) {
      rotatedCaption.textContent = meta.caption;
    }
    if (rotatedTitle) {
      rotatedTitle.textContent = 'Rotated input ' + state.rotation + ' deg';
    }
    if (stageNote) {
      stageNote.textContent = meta.note;
    }

    var normalGrid = normalLane[state.stage];
    var rotatedGrid = rotatedLane[state.stage];
    var setsMatch = windowSetsMatch(normalGrid, rotatedGrid, meta.windowSize);
    if (invarianceStatus) {
      invarianceStatus.textContent = setsMatch
        ? 'all ' + (normalGrid.length / meta.windowSize) * (normalGrid[0].length / meta.windowSize) + ' window sets match'
        : 'window sets disagree';
    }
    if (trackedWindowStatus) {
      var normalDesc = describeTrackedWindow(normalGrid, meta.windowSize);
      var rotatedDesc = describeTrackedWindow(rotatedGrid, meta.windowSize);
      trackedWindowStatus.textContent = 'normal ' + normalDesc + ' · rotated ' + rotatedDesc;
    }

    rotationButtons.forEach(function(button) {
      button.classList.toggle('is-active', Number(button.dataset.rotation) === state.rotation);
    });
    stageButtons.forEach(function(button) {
      button.classList.toggle('is-active', button.dataset.stage === state.stage);
    });
  }

  rotationButtons.forEach(function(button) {
    button.addEventListener('click', function() {
      state.rotation = Number(button.dataset.rotation) || 90;
      render();
    });
  });

  stageButtons.forEach(function(button) {
    button.addEventListener('click', function() {
      state.stage = button.dataset.stage || 'expanded';
      render();
    });
  });

  var resizeTimer = null;
  window.addEventListener('resize', function() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(render, 80);
  });

  render();
}

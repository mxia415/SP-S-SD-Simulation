(function runDynamicsAnimation() {
  "use strict";

  const DATA = window.SPS_DYNAMICS_DATA;
  const MODEL = window.SPS_PLANAR_MODEL;
  if (!DATA || !MODEL) {
    document.body.innerHTML = "<p style='padding:2rem'>动画数据或几何模型未加载。请确认 data.js 与 model-lite.js 和 index.html 位于同一目录。</p>";
    return;
  }

  const COLORS = {
    grid: "rgba(176, 176, 176, 0.28)",
    gridMajor: "rgba(128, 128, 128, 0.48)",
    axis: "#262626",
    text: "#595959",
    textStrong: "#262626",
    envelope: "rgba(176, 176, 176, 0.72)",
    excludedInterval: "#9467bd",
    pathRemaining: "rgba(127, 127, 127, 0.72)",
    pathWalked: "#1f77b4",
    layerBoundary: "#1f77b4",
    tcp: "#d62728",
    torque: "#1f77b4",
    speed: "#ff7f0e",
    rated: "#d62728",
    cursor: "#9467bd",
    panel: "#ffffff",
    arm: ["#1f77b4", "#ff7f0e", "#2ca02c"],
  };
  const RAD_TO_DEG = 180 / Math.PI;
  const SCREW_LEAD_M_PER_REV = 0.01;
  const SHARED_CHART_SCALE = Object.freeze({
    torqueMin: Number(DATA.chartScale?.torqueMinNm ?? 0),
    torqueMax: Number(DATA.chartScale?.torqueMaxNm ?? 9),
    speedMin: Number(DATA.chartScale?.speedMinMmS ?? -120),
    speedMax: Number(DATA.chartScale?.speedMaxMmS ?? 120),
  });
  const state = {
    algorithmKey: "posture_priority",
    scenarioKey: "200",
    hardwareKey: "1",
    time: 0,
    rate: 20,
    playing: false,
    lastTimestamp: null,
    lastPaintTimestamp: 0,
  };

  const elements = {
    algorithm: document.getElementById("algorithm-select"),
    scenario: document.getElementById("scenario-select"),
    hardware: document.getElementById("hardware-select"),
    rate: document.getElementById("rate-select"),
    play: document.getElementById("play-button"),
    reset: document.getElementById("reset-button"),
    slider: document.getElementById("time-slider"),
    timeOutput: document.getElementById("time-output"),
    pathOutput: document.getElementById("path-output"),
    layerOutput: document.getElementById("layer-output"),
    motionCanvas: document.getElementById("motion-canvas"),
    chartCanvas: document.getElementById("chart-canvas"),
    poseReadout: document.getElementById("pose-readout"),
    metricGrid: document.getElementById("metric-grid"),
    scaleOutput: document.getElementById("scale-output"),
    dataSource: document.getElementById("data-source"),
    pathDistanceBadge: document.getElementById("path-distance-badge"),
    pathLimitBadge: document.getElementById("path-limit-badge"),
  };

  let motionBackground = document.createElement("canvas");
  let chartBackground = document.createElement("canvas");
  let chartLayouts = [];
  let resizeQueued = false;

  function algorithm() {
    return DATA.algorithms?.[state.algorithmKey] ?? {
      label: "强姿态解析 φ",
      shortLabel: "强姿态",
      scenarios: DATA.scenarios,
    };
  }
  function scenario() { return algorithm().scenarios[state.scenarioKey]; }
  function hardware() { return DATA.hardwareSets[state.hardwareKey]; }

  function setCanvasResolution(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(height * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { context, width, height, dpr };
  }

  function binaryBracket(values, target) {
    if (target <= values[0]) return { left: 0, right: 0, alpha: 0 };
    const last = values.length - 1;
    if (target >= values[last]) return { left: last, right: last, alpha: 0 };
    let low = 0;
    let high = last;
    while (low + 1 < high) {
      const middle = (low + high) >> 1;
      if (values[middle] <= target) low = middle;
      else high = middle;
    }
    const span = values[high] - values[low];
    return { left: low, right: high, alpha: span > 0 ? (target - values[low]) / span : 0 };
  }

  function interpolate(values, bracket) {
    if (bracket.left === bracket.right) return values[bracket.left];
    return values[bracket.left] + (values[bracket.right] - values[bracket.left]) * bracket.alpha;
  }

  function currentFrame() {
    const columns = scenario().columns;
    const bracket = binaryBracket(columns.t, state.time);
    const value = (key) => interpolate(columns[key], bracket);
    return {
      bracket,
      t: state.time,
      s: value("s"),
      x: value("x"),
      z: value("z"),
      q: [value("q1"), value("q2"), value("q3"), value("qo")],
      speed: [value("v1") * 1000, value("v2") * 1000, value("v3") * 1000],
      force: [value("f1"), value("f2"), value("f3")],
      leg: columns.leg[bracket.left],
      layer: columns.layer[bracket.left],
    };
  }

  function motorTorqueNmForHardware(forceN, armIndex, hardwareSet) {
    const arm = hardwareSet.arms[armIndex];
    return Math.abs(forceN) * DATA.loadShareCorrection[armIndex] * SCREW_LEAD_M_PER_REV / (2 * Math.PI * arm.ratio);
  }

  function motorTorqueNm(forceN, armIndex) {
    return motorTorqueNmForHardware(forceN, armIndex, hardware());
  }

  function currentParameterEnvelopePoints() {
    if (
      DATA.envelope?.id !== "current_parameter_envelope"
      || DATA.envelope?.status !== "formal"
    ) return [];
    return (DATA.envelope?.pointsXZ || [])
      .map((point) => ({ x: Number(point[0]), z: Number(point[1]) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.z));
  }

  function excludedEnvelopeSegments() {
    if (
      DATA.envelope?.id !== "current_parameter_envelope"
      || DATA.envelope?.status !== "formal"
    ) return [];
    return (DATA.envelope?.excludedDisconnectedIntervals || []).flatMap((section) => {
      const z = Number(section?.zMm);
      if (!Number.isFinite(z)) return [];
      return (section?.intervals || []).map((interval) => ({
        z,
        minimumX: Number(interval?.minimumXmm),
        maximumX: Number(interval?.maximumXmm),
      })).filter((interval) => (
        Number.isFinite(interval.minimumX)
        && Number.isFinite(interval.maximumX)
        && interval.maximumX > interval.minimumX
      ));
    });
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function motionTransform(width, height) {
    const envelope = currentParameterEnvelopePoints();
    const allX = [...DATA.path.x.map(Number), ...envelope.map((point) => point.x)];
    const allZ = [...DATA.path.z.map(Number), ...envelope.map((point) => point.z)];
    const minimumX = Math.min(...allX);
    const maximumX = Math.max(...allX);
    const minimumZ = Math.min(...allZ);
    const maximumZ = Math.max(...allZ);
    const bounds = {
      xMin: Math.min(-800, Math.floor((minimumX - 500) / 1000) * 1000),
      xMax: Math.max(6500, Math.ceil((maximumX + 250) / 1000) * 1000),
      zMin: Math.min(-400, Math.floor((minimumZ - 250) / 1000) * 1000),
      zMax: Math.max(7000, Math.ceil((maximumZ + 500) / 1000) * 1000),
    };
    const padding = { left: 51, right: 24, top: 25, bottom: 39 };
    const scale = Math.min(
      (width - padding.left - padding.right) / (bounds.xMax - bounds.xMin),
      (height - padding.top - padding.bottom) / (bounds.zMax - bounds.zMin)
    );
    const contentWidth = (bounds.xMax - bounds.xMin) * scale;
    const contentHeight = (bounds.zMax - bounds.zMin) * scale;
    const left = padding.left + (width - padding.left - padding.right - contentWidth) / 2;
    const bottom = padding.bottom + (height - padding.top - padding.bottom - contentHeight) / 2;
    return {
      point(x, z) {
        return {
          x: left + (x - bounds.xMin) * scale,
          y: height - bottom - (z - bounds.zMin) * scale,
        };
      },
      scale,
      bounds,
    };
  }

  function buildMotionBackground() {
    const target = setCanvasResolution(elements.motionCanvas);
    motionBackground.width = elements.motionCanvas.width;
    motionBackground.height = elements.motionCanvas.height;
    const context = motionBackground.getContext("2d");
    context.setTransform(target.dpr, 0, 0, target.dpr, 0, 0);
    context.clearRect(0, 0, target.width, target.height);
    const transform = motionTransform(target.width, target.height);

    context.font = "10px 'DejaVu Sans', Arial, sans-serif";
    context.lineWidth = 1;
    for (let x = 0; x <= transform.bounds.xMax; x += 1000) {
      const top = transform.point(x, transform.bounds.zMax);
      const bottom = transform.point(x, transform.bounds.zMin);
      context.strokeStyle = x === 0 ? COLORS.gridMajor : COLORS.grid;
      context.beginPath(); context.moveTo(top.x, top.y); context.lineTo(bottom.x, bottom.y); context.stroke();
      context.fillStyle = COLORS.text;
      context.textAlign = "center";
      context.fillText(String(x), bottom.x, target.height - 13);
    }
    for (let z = 0; z <= transform.bounds.zMax; z += 1000) {
      const left = transform.point(transform.bounds.xMin, z);
      const right = transform.point(transform.bounds.xMax, z);
      context.strokeStyle = z === 0 ? COLORS.gridMajor : COLORS.grid;
      context.beginPath(); context.moveTo(left.x, left.y); context.lineTo(right.x, right.y); context.stroke();
      context.fillStyle = COLORS.text;
      context.textAlign = "right";
      context.fillText(String(z), 43, left.y + 3);
    }
    context.fillStyle = COLORS.text;
    context.textAlign = "right";
    context.fillText("X / mm", target.width - 18, target.height - 13);
    context.save();
    context.translate(14, 28);
    context.rotate(-Math.PI / 2);
    context.textAlign = "right";
    context.fillText("Z / mm", 0, 0);
    context.restore();

    const envelope = currentParameterEnvelopePoints();
    if (envelope.length >= 3) {
      context.save();
      context.strokeStyle = COLORS.envelope;
      context.fillStyle = "rgba(176, 176, 176, 0.055)";
      context.lineWidth = 1.5;
      context.setLineDash([]);
      context.beginPath();
      envelope.forEach((sample, index) => {
        const point = transform.point(sample.x, sample.z);
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
    }

    const excludedSegments = excludedEnvelopeSegments();
    if (excludedSegments.length > 0) {
      context.save();
      context.strokeStyle = COLORS.excludedInterval;
      context.lineWidth = 2.5;
      context.setLineDash([3, 3]);
      for (const segment of excludedSegments) {
        const start = transform.point(segment.minimumX, segment.z);
        const end = transform.point(segment.maximumX, segment.z);
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
      }
      context.restore();
    }

    const path = DATA.path;
    context.strokeStyle = COLORS.pathRemaining;
    context.lineWidth = 2;
    context.setLineDash([5, 5]);
    context.beginPath();
    for (let index = 0; index < path.x.length; index += 1) {
      const point = transform.point(path.x[index], path.z[index]);
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.stroke();
    context.setLineDash([]);
    for (const boundary of path.layerBoundaries || []) {
      const boundaryX = Number(
        boundary.farXMaxMm
        ?? boundary.xMaxMm
        ?? boundary.rightXmm
        ?? boundary.maximumXmm
      );
      if (!Number.isFinite(boundaryX) || !Number.isFinite(Number(boundary.zMm))) continue;
      const point = transform.point(boundaryX, Number(boundary.zMm));
      context.fillStyle = COLORS.layerBoundary;
      context.beginPath();
      context.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function upperPathIndex(pathPositions, currentPosition) {
    let low = 0;
    let high = pathPositions.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (pathPositions[middle] <= currentPosition) low = middle + 1;
      else high = middle;
    }
    return Math.max(1, low);
  }

  function renderMotion(frame) {
    const target = setCanvasResolution(elements.motionCanvas);
    const context = target.context;
    context.clearRect(0, 0, target.width, target.height);
    context.drawImage(motionBackground, 0, 0, motionBackground.width, motionBackground.height, 0, 0, target.width, target.height);
    const transform = motionTransform(target.width, target.height);
    const path = DATA.path;
    const walkedCount = upperPathIndex(path.s, frame.s);

    context.save();
    context.strokeStyle = COLORS.pathWalked;
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    context.lineWidth = 3;
    context.beginPath();
    for (let index = 0; index < walkedCount; index += 1) {
      const point = transform.point(path.x[index], path.z[index]);
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.stroke();
    context.restore();

    const pose = MODEL.computePoseFromRadians(frame.q[0], frame.q[1], frame.q[2], frame.q[3]);
    context.lineCap = "round";
    context.lineJoin = "round";
    for (let index = 0; index < 3; index += 1) {
      const start = transform.point(pose.joints[index].x, pose.joints[index].z);
      const end = transform.point(pose.joints[index + 1].x, pose.joints[index + 1].z);
      context.strokeStyle = "#4d4d4d";
      context.lineWidth = 9;
      context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke();
      context.strokeStyle = COLORS.arm[index];
      context.lineWidth = 6;
      context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke();
    }
    const wrist = transform.point(pose.joints[3].x, pose.joints[3].z);
    const tool = transform.point(pose.toolCenter.x, pose.toolCenter.z);
    context.strokeStyle = "#4d4d4d";
    context.lineWidth = 8;
    context.beginPath(); context.moveTo(wrist.x, wrist.y); context.lineTo(tool.x, tool.y); context.stroke();
    context.strokeStyle = COLORS.tcp;
    context.lineWidth = 5;
    context.beginPath(); context.moveTo(wrist.x, wrist.y); context.lineTo(tool.x, tool.y); context.stroke();

    pose.joints.forEach((joint, index) => {
      const point = transform.point(joint.x, joint.z);
      context.fillStyle = index === 0 ? "#ffffff" : COLORS.arm[Math.max(0, index - 1)];
      context.strokeStyle = "#262626";
      context.lineWidth = 2;
      context.beginPath(); context.arc(point.x, point.y, index === 0 ? 7 : 6, 0, Math.PI * 2); context.fill(); context.stroke();
    });

    const tcp = transform.point(frame.x, frame.z);
    context.save();
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    context.fillStyle = COLORS.tcp;
    context.beginPath(); context.arc(tcp.x, tcp.y, 7, 0, Math.PI * 2); context.fill();
    context.restore();

    const label = `TCP ${frame.x.toFixed(0)}, ${frame.z.toFixed(0)} mm`;
    context.font = "600 11px 'DejaVu Sans', Arial, sans-serif";
    const labelWidth = context.measureText(label).width + 18;
    const labelX = Math.min(target.width - labelWidth - 8, Math.max(8, tcp.x + 11));
    const labelY = Math.max(8, tcp.y - 29);
    roundedRect(context, labelX, labelY, labelWidth, 23, 7);
    context.fillStyle = "rgba(255, 255, 255, 0.94)";
    context.fill();
    context.strokeStyle = "#d62728";
    context.stroke();
    context.fillStyle = COLORS.textStrong;
    context.textAlign = "left";
    context.fillText(label, labelX + 9, labelY + 15.5);
  }

  function drawPlotGrid(context, area, domainMin, domainMax, formatter) {
    context.fillStyle = COLORS.panel;
    context.fillRect(area.x, area.y, area.width, area.height);
    context.font = "9px 'DejaVu Sans', Arial, sans-serif";
    context.textAlign = "right";
    context.textBaseline = "middle";
    for (let tick = 0; tick <= 4; tick += 1) {
      const y = area.y + (tick / 4) * area.height;
      const value = domainMax - (tick / 4) * (domainMax - domainMin);
      context.strokeStyle = tick === 4 ? COLORS.gridMajor : COLORS.grid;
      context.lineWidth = 1;
      context.beginPath(); context.moveTo(area.x, y); context.lineTo(area.x + area.width, y); context.stroke();
      context.fillStyle = COLORS.text;
      context.fillText(formatter(value), area.x - 5, y);
    }
  }

  function plotSeries(context, area, values, domainMin, domainMax, color) {
    const times = scenario().columns.t;
    const duration = scenario().durationS;
    const yFor = (value) => area.y + (domainMax - value) / (domainMax - domainMin) * area.height;
    context.save();
    context.beginPath(); context.rect(area.x, area.y, area.width, area.height); context.clip();
    context.strokeStyle = color;
    context.lineWidth = 1.45;
    context.beginPath();
    for (let index = 0; index < values.length; index += 1) {
      const x = area.x + (times[index] / duration) * area.width;
      const y = yFor(values[index]);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    context.restore();
  }

  function ratedLine(context, area, value, domainMin, domainMax) {
    const y = area.y + (domainMax - value) / (domainMax - domainMin) * area.height;
    if (y < area.y - 0.5 || y > area.y + area.height + 0.5) return;
    context.save();
    context.strokeStyle = COLORS.rated;
    context.lineWidth = 1.2;
    context.setLineDash([6, 4]);
    context.beginPath(); context.moveTo(area.x, y); context.lineTo(area.x + area.width, y); context.stroke();
    context.restore();
  }

  function buildChartBackground() {
    const target = setCanvasResolution(elements.chartCanvas);
    chartBackground.width = elements.chartCanvas.width;
    chartBackground.height = elements.chartCanvas.height;
    const context = chartBackground.getContext("2d");
    context.setTransform(target.dpr, 0, 0, target.dpr, 0, 0);
    context.clearRect(0, 0, target.width, target.height);
    const columns = scenario().columns;
    const left = 38;
    const right = 14;
    const top = 12;
    const bottom = 24;
    const columnGap = 28;
    const rowGap = 10;
    const cellWidth = (target.width - left - right - columnGap) / 2;
    const rowHeight = (target.height - top - bottom - rowGap * 2) / 3;
    chartLayouts = [];

    for (let armIndex = 0; armIndex < 3; armIndex += 1) {
      const arm = hardware().arms[armIndex];
      const rowY = top + armIndex * (rowHeight + rowGap);
      const plotY = rowY + 22;
      const plotHeight = rowHeight - 28;
      const torqueArea = { x: left, y: plotY, width: cellWidth, height: plotHeight };
      const speedArea = { x: left + cellWidth + columnGap, y: plotY, width: cellWidth, height: plotHeight };
      const forces = columns[`f${armIndex + 1}`];
      const speeds = columns[`v${armIndex + 1}`];
      const torqueValues = new Array(forces.length);
      const speedValues = new Array(speeds.length);
      for (let index = 0; index < forces.length; index += 1) {
        const torque = motorTorqueNm(forces[index], armIndex);
        const speed = speeds[index] * 1000;
        torqueValues[index] = torque;
        speedValues[index] = speed;
      }
      const torqueMin = SHARED_CHART_SCALE.torqueMin;
      const torqueMax = SHARED_CHART_SCALE.torqueMax;
      const speedMin = SHARED_CHART_SCALE.speedMin;
      const speedMax = SHARED_CHART_SCALE.speedMax;

      context.font = "600 10px 'DejaVu Sans', Arial, sans-serif";
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      context.fillStyle = COLORS.textStrong;
      context.fillText(`${arm.label}  |T轴需求| / N·m`, torqueArea.x, rowY + 13);
      context.fillText(`${arm.label}  电缸线速度 / mm·s⁻¹`, speedArea.x, rowY + 13);
      context.textAlign = "right";
      context.fillStyle = COLORS.text;
      context.font = "9px 'DejaVu Sans', Arial, sans-serif";
      context.fillText(`额定 ${arm.ratedTorqueNm.toFixed(2)}`, torqueArea.x + torqueArea.width, rowY + 13);
      context.fillText(`额定 ±${arm.ratedSpeedMmS.toFixed(0)}`, speedArea.x + speedArea.width, rowY + 13);

      drawPlotGrid(context, torqueArea, torqueMin, torqueMax, (value) => value.toFixed(1));
      drawPlotGrid(context, speedArea, speedMin, speedMax, (value) => value.toFixed(0));
      plotSeries(context, torqueArea, torqueValues, torqueMin, torqueMax, COLORS.torque);
      plotSeries(context, speedArea, speedValues, speedMin, speedMax, COLORS.speed);
      ratedLine(context, torqueArea, arm.ratedTorqueNm, torqueMin, torqueMax);
      ratedLine(context, speedArea, arm.ratedSpeedMmS, speedMin, speedMax);
      ratedLine(context, speedArea, -arm.ratedSpeedMmS, speedMin, speedMax);

      chartLayouts.push({ torqueArea, speedArea, torqueMin, torqueMax, speedMin, speedMax });
    }
    elements.chartCanvas.dataset.torqueMin = String(SHARED_CHART_SCALE.torqueMin);
    elements.chartCanvas.dataset.torqueMax = String(SHARED_CHART_SCALE.torqueMax);
    elements.chartCanvas.dataset.speedMin = String(SHARED_CHART_SCALE.speedMin);
    elements.chartCanvas.dataset.speedMax = String(SHARED_CHART_SCALE.speedMax);
    context.fillStyle = COLORS.text;
    context.font = "9px 'DejaVu Sans', Arial, sans-serif";
    context.textAlign = "left";
    context.fillText("0 s", left, target.height - 7);
    context.textAlign = "right";
    context.fillText(`${scenario().durationS.toFixed(1)} s`, target.width - right, target.height - 7);
  }

  function renderChart(frame) {
    const target = setCanvasResolution(elements.chartCanvas);
    const context = target.context;
    context.clearRect(0, 0, target.width, target.height);
    context.drawImage(chartBackground, 0, 0, chartBackground.width, chartBackground.height, 0, 0, target.width, target.height);
    const fraction = state.time / scenario().durationS;

    chartLayouts.forEach((layout, armIndex) => {
      const torque = motorTorqueNm(frame.force[armIndex], armIndex);
      const speed = frame.speed[armIndex];
      [layout.torqueArea, layout.speedArea].forEach((area) => {
        const x = area.x + fraction * area.width;
        context.strokeStyle = COLORS.cursor;
        context.lineWidth = 1;
        context.beginPath(); context.moveTo(x, area.y); context.lineTo(x, area.y + area.height); context.stroke();
      });
      const tx = layout.torqueArea.x + fraction * layout.torqueArea.width;
      const ty = layout.torqueArea.y + (layout.torqueMax - torque) / (layout.torqueMax - layout.torqueMin) * layout.torqueArea.height;
      const sx = layout.speedArea.x + fraction * layout.speedArea.width;
      const sy = layout.speedArea.y + (layout.speedMax - speed) / (layout.speedMax - layout.speedMin) * layout.speedArea.height;
      context.fillStyle = COLORS.cursor;
      context.beginPath(); context.arc(tx, ty, 3, 0, Math.PI * 2); context.fill();
      context.beginPath(); context.arc(sx, sy, 3, 0, Math.PI * 2); context.fill();
    });
  }

  function updateReadouts(frame) {
    const duration = scenario().durationS;
    const distance = scenario().distanceMm;
    elements.timeOutput.value = `${frame.t.toFixed(2)} / ${duration.toFixed(2)} s`;
    elements.pathOutput.value = `${(frame.s / 1000).toFixed(3)} / ${(distance / 1000).toFixed(3)} m`;
    elements.layerOutput.value = `第 ${Number(frame.layer) + 1} 层 · 路段 ${Number(frame.leg) + 1}`;
    elements.poseReadout.innerHTML = [
      ["TCP X", frame.x.toFixed(1), "mm"],
      ["TCP Z", frame.z.toFixed(1), "mm"],
      ["Arm1", (frame.q[0] * RAD_TO_DEG).toFixed(2), "°"],
      ["Arm2", (frame.q[1] * RAD_TO_DEG).toFixed(2), "°"],
      ["Arm3", (frame.q[2] * RAD_TO_DEG).toFixed(2), "°"],
    ].map(([label, value, unit]) => `<span>${label} <b>${value}</b> ${unit}</span>`).join("");

    elements.metricGrid.innerHTML = hardware().arms.map((arm, armIndex) => {
      const torque = motorTorqueNm(frame.force[armIndex], armIndex);
      const speed = frame.speed[armIndex];
      const torqueUtil = torque / arm.ratedTorqueNm;
      const speedUtil = Math.abs(speed) / arm.ratedSpeedMmS;
      const motorIdentity = [
        arm.motorModel === "unknown_pending_supplier_data" ? "" : arm.motorModel,
        `${arm.motorKw.toFixed(2)} kW`,
        `i=${arm.ratio}`,
      ].filter(Boolean).join(" · ");
      return `
        <article class="metric-card">
          <h3>${arm.label} · ${hardware().label}</h3>
          <p class="motor-model">${motorIdentity}</p>
          <div class="metric-row"><span>|T轴| / 额定</span><b class="${torqueUtil > 1 ? "over" : "ok"}">${torque.toFixed(3)} / ${arm.ratedTorqueNm.toFixed(3)} N·m</b></div>
          <div class="metric-row"><span>v缸 / ±额定</span><b class="${speedUtil > 1 ? "over" : "ok"}">${speed.toFixed(2)} / ±${arm.ratedSpeedMmS.toFixed(0)} mm/s</b></div>
          <div class="metric-row"><span>瞬时利用率</span><b class="${Math.max(torqueUtil, speedUtil) > 1 ? "over" : "ok"}">T ${(torqueUtil * 100).toFixed(1)}% · v ${(speedUtil * 100).toFixed(1)}%</b></div>
        </article>`;
    }).join("");
  }

  function paint() {
    const frame = currentFrame();
    renderMotion(frame);
    renderChart(frame);
    updateReadouts(frame);
    elements.slider.value = String(state.time);
  }

  function setPlaying(playing) {
    state.playing = Boolean(playing);
    state.lastTimestamp = null;
    elements.play.textContent = state.playing ? "❚❚ 暂停" : "▶ 播放";
    elements.play.setAttribute("aria-pressed", String(state.playing));
  }

  function animationLoop(timestamp) {
    if (state.playing) {
      if (state.lastTimestamp == null) state.lastTimestamp = timestamp;
      const elapsed = Math.min(0.1, (timestamp - state.lastTimestamp) / 1000);
      state.lastTimestamp = timestamp;
      state.time += elapsed * state.rate;
      if (state.time >= scenario().durationS) {
        state.time = scenario().durationS;
        setPlaying(false);
      }
    }
    if (state.playing || timestamp - state.lastPaintTimestamp >= 33) {
      paint();
      state.lastPaintTimestamp = timestamp;
    }
    requestAnimationFrame(animationLoop);
  }

  function configureScenario(preserveFraction) {
    const oldDuration = Number(elements.slider.max) || 1;
    const fraction = preserveFraction ? state.time / oldDuration : 0;
    const duration = scenario().durationS;
    state.time = Math.min(duration, Math.max(0, fraction * duration));
    elements.slider.max = String(duration);
    elements.slider.step = "0.01";
    elements.pathDistanceBadge.textContent = `${(scenario().distanceMm / 1000).toFixed(3)} m`;
    const envelopeMaximumZ = Math.max(
      ...currentParameterEnvelopePoints().map((point) => point.z),
    );
    elements.pathLimitBadge.textContent = Number.isFinite(envelopeMaximumZ)
      ? `计算包络 Z ${envelopeMaximumZ.toFixed(1)} mm`
      : "待重建当前参数包络";
    elements.dataSource.textContent = (
      `算法：${algorithm().label}；数据目录：${scenario().sourceDirectory}；几何：${DATA.geometrySource}`
    );
    buildChartBackground();
    paint();
  }

  function rebuildAll() {
    resizeQueued = false;
    buildMotionBackground();
    buildChartBackground();
    paint();
  }

  elements.algorithm.addEventListener("change", () => {
    state.algorithmKey = elements.algorithm.value;
    configureScenario(true);
  });
  elements.scenario.addEventListener("change", () => {
    state.scenarioKey = elements.scenario.value;
    configureScenario(true);
  });
  elements.hardware.addEventListener("change", () => {
    state.hardwareKey = elements.hardware.value;
    buildChartBackground();
    paint();
  });
  elements.rate.addEventListener("change", () => { state.rate = Number(elements.rate.value); });
  elements.play.addEventListener("click", () => {
    if (!state.playing && state.time >= scenario().durationS) state.time = 0;
    setPlaying(!state.playing);
  });
  elements.reset.addEventListener("click", () => { setPlaying(false); state.time = 0; paint(); });
  elements.slider.addEventListener("input", () => { state.time = Number(elements.slider.value); paint(); });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" && event.target.tagName !== "SELECT" && event.target.tagName !== "INPUT") {
      event.preventDefault();
      elements.play.click();
    }
  });

  const resizeObserver = new ResizeObserver(() => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(rebuildAll);
  });
  resizeObserver.observe(elements.motionCanvas.parentElement);
  resizeObserver.observe(elements.chartCanvas.parentElement);

  elements.scaleOutput.textContent = (
    `三种算法统一量程：|T轴| ${SHARED_CHART_SCALE.torqueMin.toFixed(0)}–${SHARED_CHART_SCALE.torqueMax.toFixed(0)} N·m；`
    + `v缸 ${SHARED_CHART_SCALE.speedMin.toFixed(0)}–+${SHARED_CHART_SCALE.speedMax.toFixed(0)} mm/s。`
  );
  elements.algorithm.value = state.algorithmKey;
  elements.scenario.value = state.scenarioKey;
  elements.hardware.value = state.hardwareKey;
  elements.rate.value = String(state.rate);
  configureScenario(false);
  requestAnimationFrame(animationLoop);
})();

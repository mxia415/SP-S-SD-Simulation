(function exposeSpsPlanarPose(global) {
  "use strict";

  // Exact planar subset of outputs/html-version/model.mjs::computePose.
  // Constants and relative-angle convention are intentionally kept identical
  // so this standalone file:// animation does not introduce a second model.
  const BASE_JOINT = Object.freeze({ x: -450.742, z: 385.188 });
  const ARM_LENGTHS_MM = Object.freeze([3396.989, 3047.007, 2053.5640000000003]);
  const TOOL_LENGTH_MM = 747.536;

  function nextJoint(origin, absoluteAngleRad, lengthMm) {
    return {
      x: origin.x + lengthMm * Math.cos(absoluteAngleRad),
      z: origin.z + lengthMm * Math.sin(absoluteAngleRad),
    };
  }

  function computePoseFromRadians(q1, q2, q3, qOffset) {
    const absoluteAngles = [q1, q1 - q2, q1 - q2 - q3];
    const joints = [{ ...BASE_JOINT }];
    for (let index = 0; index < 3; index += 1) {
      joints.push(nextJoint(joints[index], absoluteAngles[index], ARM_LENGTHS_MM[index]));
    }
    const toolAngle = absoluteAngles[2] - qOffset;
    const toolCenter = nextJoint(joints[3], toolAngle, TOOL_LENGTH_MM);
    return { joints, toolCenter, absoluteAngles, toolAngle };
  }

  global.SPS_PLANAR_MODEL = Object.freeze({
    source: "outputs/html-version/model.mjs::computePose",
    BASE_JOINT,
    ARM_LENGTHS_MM,
    TOOL_LENGTH_MM,
    computePoseFromRadians,
  });
})(window);

// Keep a slow interval job from starting another copy before it finishes.
// Each job gets its own guard; a rejected run must not disable future ticks.
module.exports = function nonOverlappingTask(task) {
  let running = false;
  return async function (...args) {
    if (running) return undefined;
    running = true;
    try {
      return await task.apply(this, args);
    } finally {
      running = false;
    }
  };
};

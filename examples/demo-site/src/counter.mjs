export function createCounter(start = 0) {
  let value = start;
  return {
    get value() {
      return value;
    },
    increment() {
      value += 1;
    },
    decrement() {
      value -= 1;
    },
  };
}

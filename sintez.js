export { encodeWAV, evaluate, generatePCM, tokenize, typify };

// sample[n]= A ⋅ sin(2 * π * f * (n / R)​)

// Where:
//   A: Amplitude (max value based on bit depth, e.g., 32767 for 16-bit)
//   f: Frequency (Hz), e.g., middle C = 261.63 Hz
//   R: Sample rate (samples per second), typically 44100 Hz
//   n: Sample number (integer), from 0 to R × duration − 1

function generatePCM(frequency, duration) {
  const amplitude = 32767;
  const sampleRate = 44100;

  const numSamples = Math.floor(sampleRate * (duration / 1000));

  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = amplitude * Math.sin(2 * Math.PI * frequency * t);
    samples.push(sample);
  }

  return samples;
}

async function encodeWAV(
  samples,
  output = "output.wav",
  sampleRate = 44100,
) {
  const headerSize = 44;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(headerSize + i * 2, samples[i], true);
  }

  await Deno.writeFile(
    output,
    new Uint8Array(buffer),
  );
}

const atom = (name) => Symbol.for(name);
const typify = (name) => {
  if (isNaN(Number(name))) {
    return atom(name);
  } else {
    return Number(name);
  }
};

const tokenize = (input) => {
  const loop = (inputArr, shelf, stack) => {
    if (inputArr.length === 0) {
      if (shelf !== "") stack[stack.length - 1].push(typify(shelf));
      return stack[0];
    }

    const [f, ...r] = inputArr;

    switch (f) {
      case " ":
        if (shelf) {
          stack[stack.length - 1].push(typify(shelf));
          shelf = "";
        }
        break;

      case "(":
        stack.push([]);
        break;

      case ")":
        if (shelf) {
          stack[stack.length - 1].push(typify(shelf));
          shelf = "";
        }

        const group = stack.pop();
        stack[stack.length - 1].push(group);
        break;

      default:
        shelf += f;
        break;
    }

    return loop(r, shelf, stack);
  };

  return loop(Array.from(input), "", [[]]);
};

const evaluate = (expression) => {
  const match = {
    "+": (a, b) => a + b,
    "-": (a, b) => a - b,
    "*": (a, b) => a * b,
    "/": (a, b) => a / b,
    [Symbol.for("tone")]: (frequency, durationMs) => {
      const sampleRate = 44100;
      const sampleCount = Math.floor(sampleRate * durationMs / 1000);
      const samples = new Int16Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        const t = i / sampleRate;
        const amplitude = 32760;
        samples[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
      }
      return samples;
    },
  };

  if (typeof expression === "number") return expression;
  if (!Array.isArray(expression)) {
    throw new Error("Invalid expression: " + expression.toString());
  }
  const [operator, ...operands] = expression;
  const key = typeof operator === "symbol" ? operator : operator.toString();
  const fn = match[key];
  if (!fn) throw new Error("Unknown operator: " + key.toString());
  const evaList = operands.map(evaluate);
  return fn(...evaList);
};

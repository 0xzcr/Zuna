export class NarrationQueue {
  constructor(runtime, voice = 'male') {
    this.runtime = runtime;
    this.voice = voice;
    this.tail = Promise.resolve();
    this.generation = 0;
  }

  setVoice(voice) {
    this.voice = voice;
  }

  cancel() {
    this.generation += 1;
  }

  generate(text, targetSeconds, progress) {
    const voice = this.voice;
    const generation = this.generation;
    const job = this.tail.then(() => {
      if (generation !== this.generation) throw new Error('Narration request cancelled.');
      return this.runtime.generate(text, voice, targetSeconds, progress);
    });
    this.tail = job.catch(() => {});
    return job;
  }
}

export class GaplessPlayer {
  constructor(context = new AudioContext()) {
    this.context = context;
    this.nextStart = 0;
    this.sources = new Set();
  }

  async append(wav) {
    const buffer = await this.context.decodeAudioData(wav.slice(0));
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    const start = Math.max(this.context.currentTime + 0.03, this.nextStart);
    source.start(start);
    this.nextStart = start + buffer.duration;
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
    return start;
  }

  stop() {
    this.sources.forEach((source) => source.stop());
    this.sources.clear();
    this.nextStart = 0;
  }
}

import { WORKLET_CODE } from './noise-suppressor-worklet';

export interface DenoisedStreamResult {
  denoisedStream: MediaStream;
  cleanup: () => void;
}

// Creates a noise-suppressed version of rawStream via an AudioWorklet.
// The AnalyserNode (if provided) remains connected to the raw source so VAD
// energy detection is unaffected by suppression gain.
export async function createDenoisedStream(
  rawStream: MediaStream,
  existingContext?: AudioContext,
  existingSource?: MediaStreamAudioSourceNode,
): Promise<DenoisedStreamResult> {
  const ctx = existingContext ?? new AudioContext({ sampleRate: 48000 });
  const ownCtx = !existingContext;

  const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);

  const source = existingSource ?? ctx.createMediaStreamSource(rawStream);
  const workletNode = new AudioWorkletNode(ctx, 'noise-suppressor');
  const destination = ctx.createMediaStreamDestination();

  source.connect(workletNode);
  workletNode.connect(destination);

  return {
    denoisedStream: destination.stream,
    cleanup: () => {
      workletNode.disconnect();
      if (ownCtx) void ctx.close();
    },
  };
}

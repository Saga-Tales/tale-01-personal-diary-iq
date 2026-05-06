const MODEL_ID = 'Xenova/multilingual-e5-small'

type ProgressCallback = (progress: number, status: string) => void

// 임베딩 출력 (Float32Array를 쥐고 있는 Tensor)
type EmbedderOutput = { data: Float32Array; dims: number[] }
type Embedder = (
  text: string | string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<EmbedderOutput>

let pipelinePromise: Promise<Embedder> | null = null
let progressCallback: ProgressCallback | null = null
let isReady = false

export function setProgressCallback(cb: ProgressCallback | null) {
  progressCallback = cb
}

export function isEmbedderReady(): boolean {
  return isReady
}

async function getPipeline(): Promise<Embedder> {
  if (!pipelinePromise) {
    // dynamic import: transformers.js는 첫 호출 시점에만 로드 (~3MB chunk)
    pipelinePromise = (async () => {
      const { pipeline } = await import('@xenova/transformers')
      const extractor = await pipeline('feature-extraction', MODEL_ID, {
        progress_callback: (data: any) => {
          if (data?.status === 'progress' && typeof data.progress === 'number') {
            progressCallback?.(data.progress, data.file ?? '')
          } else if (data?.status === 'done') {
            progressCallback?.(100, data.file ?? '')
          }
        },
      })
      return extractor as unknown as Embedder
    })()

    pipelinePromise
      .then(() => {
        isReady = true
        progressCallback?.(100, 'ready')
      })
      .catch((e) => {
        console.error('[embedder] pipeline init 실패:', e)
        pipelinePromise = null
      })
  }
  return pipelinePromise
}

/**
 * 텍스트를 임베딩 벡터로 변환.
 * multilingual-e5는 prefix를 권장: "query: ..." or "passage: ..."
 */
export async function embed(text: string, kind: 'query' | 'passage' = 'passage'): Promise<number[]> {
  const extractor = await getPipeline()
  const prefixed = `${kind}: ${text}`
  const output = await extractor(prefixed, { pooling: 'mean', normalize: true })
  return Array.from(output.data as Float32Array)
}

/**
 * 모델을 미리 로드 (Chat 페이지 mount 시 호출 권장).
 * 이미 로딩 중이면 그냥 같은 Promise 반환.
 */
export async function preload(): Promise<void> {
  await getPipeline()
}

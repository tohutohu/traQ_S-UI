import {
  Ref,
  ref,
  computed,
  watch,
  readonly,
  shallowRef,
  onUnmounted
} from 'vue'
import usePictureInPicture from './pictureInPicture'
import { FileInfo } from '@traptitech/traq'
import useAudioController from '@/providers/audioController'

const toFinite = (n: number | undefined, def: number) =>
  Number.isFinite(n) ? (n as number) : def

const useIsPlaying = (
  audio: Ref<HTMLAudioElement | undefined>,
  onPlayStart?: () => void
) => {
  const isPlayingNative = ref(false)
  const wasUnsupportedType = ref(false)

  const onPlay = () => {
    isPlayingNative.value = true
  }
  const onStop = () => {
    isPlayingNative.value = false
  }

  watch(
    audio,
    (newAudio, oldAudio) => {
      if (oldAudio) {
        oldAudio.removeEventListener('play', onPlay)
        oldAudio.removeEventListener('pause', onStop)
        oldAudio.removeEventListener('ended', onStop)
        oldAudio.removeEventListener('emptied', onStop)
      }
      if (newAudio) {
        isPlayingNative.value = !newAudio.paused
        newAudio.addEventListener('play', onPlay)
        newAudio.addEventListener('pause', onStop)
        newAudio.addEventListener('ended', onStop)
        newAudio.addEventListener('emptied', onStop)
      }
    },
    { immediate: true }
  )

  const start = async () => {
    if (!audio.value) return
    try {
      await audio.value.play()
      onPlayStart?.()
    } catch (e: unknown) {
      const err = e as Error
      if (err.name === 'NotSupportedError') {
        wasUnsupportedType.value = true
      }
    }
  }
  const pause = () => {
    audio.value?.pause()
  }

  const isPlaying = computed({
    get() {
      return isPlayingNative.value
    },
    set(v) {
      if (v) {
        start()
      } else {
        pause()
      }
    }
  })

  return { wasUnsupportedType, isPlaying }
}

export const useCurrentTime = (audio: Ref<HTMLAudioElement | undefined>) => {
  const nativeCurrentTime = ref(toFinite(audio.value?.currentTime, 0))

  const onTimeupdated = () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    nativeCurrentTime.value = toFinite(audio.value!.currentTime, 0)
  }

  watch(
    audio,
    (newAudio, oldAudio) => {
      if (oldAudio) {
        oldAudio.removeEventListener('timeupdate', onTimeupdated)
      }
      if (newAudio) {
        nativeCurrentTime.value = toFinite(newAudio.currentTime, 0)
        newAudio.addEventListener('timeupdate', onTimeupdated)
      }
    },
    { immediate: true }
  )

  const currentTime = computed<number>({
    get() {
      return nativeCurrentTime.value
    },
    set(v) {
      if (!audio.value) return
      audio.value.currentTime = v
    }
  })

  return currentTime
}

export const useDuration = (audio: Ref<HTMLAudioElement | undefined>) => {
  const nativeDuration = ref(toFinite(audio.value?.duration, 0))

  const onLoadedMetadata = () => {
    if (!audio.value) return
    nativeDuration.value = toFinite(audio.value.duration, 0)
  }

  watch(
    audio,
    (newAudio, oldAudio) => {
      if (oldAudio) {
        oldAudio.removeEventListener('loadedmetadata', onLoadedMetadata)
      }
      if (newAudio) {
        nativeDuration.value = toFinite(newAudio.duration, 0)
        newAudio.addEventListener('loadedmetadata', onLoadedMetadata)
      }
    },
    { immediate: true }
  )

  const duration = readonly(nativeDuration)
  return duration
}

const useVolume = (audio: Ref<HTMLAudioElement | undefined>) => {
  const nativeVolume = ref(toFinite(audio.value?.volume, 1))

  const onVolumeChange = () => {
    if (!audio.value) return
    nativeVolume.value = toFinite(audio.value.volume, 1)
  }

  watch(
    audio,
    (newAudio, oldAudio) => {
      if (oldAudio) {
        oldAudio.removeEventListener('volumechange', onVolumeChange)
      }
      if (newAudio) {
        nativeVolume.value = toFinite(newAudio.volume, 1)
        newAudio.addEventListener('volumechange', onVolumeChange)
      }
    },
    { immediate: true }
  )

  const volume = computed<number>({
    get() {
      return nativeVolume.value
    },
    set(v) {
      if (!audio.value) return
      audio.value.volume = v / 100
    }
  })
  return volume
}

const useLoop = (audio: Ref<HTMLAudioElement | undefined>) => {
  const nativeLoop = ref(false)

  const onLoopUpdate = () => {
    if (!audio.value) return
    nativeLoop.value = audio.value.loop
  }
  const observe = (a: HTMLAudioElement) => {
    const m = new MutationObserver(onLoopUpdate)
    m.observe(a, { attributeFilter: ['loop'] })
    return m
  }
  let mo: MutationObserver | undefined

  watch(
    audio,
    (newAudio, oldAudio) => {
      if (oldAudio) {
        mo?.disconnect()
      }
      if (newAudio) {
        nativeLoop.value = newAudio.loop
        mo = observe(newAudio)
      }
    },
    { immediate: true }
  )

  const loop = computed<boolean>({
    get() {
      return nativeLoop.value
    },
    set(v) {
      if (!audio.value) return
      audio.value.loop = v
    }
  })
  return loop
}

const useAudio = (
  fileMeta: Ref<FileInfo | undefined>,
  fileRawPath: Ref<string>,
  audioArg?: Ref<HTMLAudioElement>
) => {
  const { setAudio, setShouldDestroy } = useAudioController()
  const { isPinPShown, showPictureInPictureWindow } = usePictureInPicture()

  const audio = audioArg ?? shallowRef(new Audio())

  onUnmounted(() => {
    setShouldDestroy()
  })

  const cantPlay = computed(
    () => fileMeta.value && audio.value.canPlayType(fileMeta.value.mime) === ''
  )

  watch(
    () => fileMeta.value?.mime + fileRawPath.value,
    () => {
      if (audioArg) return
      if (!audio.value.canPlayType(fileMeta.value?.mime ?? '')) return
      audio.value.src = fileRawPath.value
    },
    { immediate: true }
  )

  const onPlay = !audioArg
    ? () => {
        if (!fileMeta.value) return
        setAudio(audio.value, fileMeta.value.id)
      }
    : undefined
  const { wasUnsupportedType, isPlaying } = useIsPlaying(audio, onPlay)
  const currentTime = useCurrentTime(audio)
  const duration = useDuration(audio)
  const volume = useVolume(audio)
  const loop = useLoop(audio)

  const startPinP = (iconId: string) => {
    showPictureInPictureWindow(audio.value, iconId)
    onPlay?.()
  }
  return {
    cantPlay,
    wasUnsupportedType,
    isPlaying,
    currentTime,
    duration,
    volume,
    loop,
    isPinPShown,
    startPinP
  }
}

export default useAudio

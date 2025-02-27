import { defineActions } from 'direct-vuex'
import { moduleActionContext } from '@/store'
import { rtc } from '.'
import { ChannelId, UserId } from '@/types/entity-ids'
import { randomString } from '@/lib/util/randomString'
import { client, initClient, destroyClient } from '@/lib/webrtc/traQRTCClient'
import AudioStreamMixer, {
  getTalkingLoundnessLevel
} from '@/lib/audioStreamMixer'
import { getUserAudio } from '@/lib/webrtc/userMedia'
import { ActionContext } from 'vuex'
import { tts } from '@/lib/tts'
import { wait } from '@/lib/util/timer'
import { isIOSApp } from '@/lib/util/browser'

const defaultState = 'joined'
const talkingStateUpdateFPS = 30

export const rtcActionContext = (context: ActionContext<unknown, unknown>) =>
  moduleActionContext(context, rtc)

const updateTalkingUserState = (context: ActionContext<unknown, unknown>) => {
  const { rootGetters, state, commit, getters } = rtcActionContext(context)
  const update = () => {
    const myId = rootGetters.domain.me.myId
    const userStateDiff = new Map<UserId, number>()

    rootGetters.domain.rtc.currentSessionUsers.forEach(userId => {
      if (userId === myId) return

      const loudness = rootGetters.domain.rtc.currentMutedUsers.has(userId)
        ? 0
        : getters.getTalkingLoudnessLevel(userId)
      if (state.talkingUsersState.get(userId) !== loudness) {
        userStateDiff.set(userId, loudness)
      }
    })

    if (state.localAnalyzerNode && myId) {
      const level = state.mixer?.getLevelOfNode(state.localAnalyzerNode) ?? 0
      const loudness = getTalkingLoundnessLevel(level)
      if (state.talkingUsersState.get(myId) !== loudness) {
        userStateDiff.set(myId, loudness)
      }
    }

    commit.updateTalkingUserState(userStateDiff)
  }
  const id = window.setInterval(update, 1000 / talkingStateUpdateFPS)
  commit.setTalkingStateUpdateId(id)
}

export const actions = defineActions({
  startOrJoinRTCSession(
    context,
    payload: { channelId: ChannelId; sessionType: string }
  ): { sessionId: string; isNewSession: boolean } {
    const { rootGetters, rootState, rootDispatch } = rtcActionContext(context)
    if (
      rootGetters.domain.rtc.currentRTCState &&
      rootGetters.domain.rtc.currentRTCState?.channelId !== payload.channelId
    ) {
      throw `RTC session is already open for channel ${payload.channelId}`
    }

    const currentSessionIds = rootState.domain.rtc.channelSessionsMap.get(
      payload.channelId
    )
    const currentSession = currentSessionIds
      ? [...currentSessionIds]
          .map(sessionId => rootState.domain.rtc.sessionInfoMap.get(sessionId))
          .find(session => session?.type === payload.sessionType)
      : undefined
    const sessionId =
      currentSession?.sessionId ?? `${payload.sessionType}-${randomString()}`

    rootDispatch.domain.rtc.addRTCSession({
      channelId: payload.channelId,
      state: {
        sessionId,
        states: [defaultState]
      }
    })
    return { sessionId, isNewSession: !currentSession }
  },

  // ---- RTC Connection ---- //
  async ensureDevicePermission(context) {
    const { rootDispatch, rootState } = rtcActionContext(context)
    if (!rootState.app.rtcSettings.isEnabled) {
      return false
    }
    if (
      isIOSApp(window) &&
      !(await window.webkit.messageHandlers.scriptMessageHandler.postMessage(
        'RequestMicrophone'
      ))
    ) {
      window.alert('設定アプリからマイクの使用を許可してください')
      return false
    }
    if (!(await rootDispatch.app.rtcSettings.ensureDeviceIds())) {
      window.alert('マイクの設定に失敗しました')
      return false
    }
    return true
  },

  async initializeMixer(context) {
    const { state, commit, rootState } = rtcActionContext(context)
    const mixer = new AudioStreamMixer(rootState.app.rtcSettings.masterVolume)

    const promises: Array<Promise<void>> = []
    state.remoteAudioStreamMap.forEach((stream, userId) =>
      promises.push(mixer.addStream(userId, stream))
    )

    promises.push(mixer.addFileSource('qall_start', '/static/qall_start.mp3'))
    promises.push(mixer.addFileSource('qall_end', '/static/qall_end.mp3'))
    promises.push(mixer.addFileSource('qall_joined', '/static/qall_joined.mp3'))
    promises.push(mixer.addFileSource('qall_left', '/static/qall_left.mp3'))

    await Promise.all(promises)

    commit.setMixer(mixer)
  },

  async establishConnection(context) {
    const { rootGetters, dispatch, rootDispatch } = rtcActionContext(context)
    if (!rootGetters.domain.me.myId) {
      throw 'application not initialized'
    }
    if (client) {
      client.closeConnection()
    }
    const id = rootGetters.domain.me.myId
    initClient(id)
    client?.addEventListener('connectionerror', async e => {
      /* eslint-disable-next-line no-console */
      console.error(`[RTC] Failed to establish connection`)
      if (e.detail.err.type === 'unavailable-id') {
        /* eslint-disable-next-line no-console */
        console.error(`[RTC] Peer Id already in use!`)
      }
      window.alert('接続に失敗しました')

      await dispatch.closeConnection()
      // session接続後にCredential expiredで切れる場合は退出しないといけない
      const qallSession = rootGetters.domain.rtc.qallSession
      if (qallSession) {
        rootDispatch.domain.rtc.removeRTCSession({
          sessionId: qallSession.sessionId
        })
        tts.stop()
      }
    })
    client?.addEventListener('connectionclose', () => {
      // eslint-disable-next-line no-console
      console.log('[RTC] connection closed')
    })
    await client?.establishConnection()
  },

  closeConnection(context) {
    const { state, commit, dispatch } = rtcActionContext(context)
    if (!client) {
      return
    }
    if (state.mixer) {
      state.mixer.playFileSource('qall_end')
      state.mixer.muteAll()
      dispatch.stopTalkStateUpdate()
    }
    client.closeConnection()
    destroyClient()
    commit.unsetMixer()
    commit.unsetLocalStream()
    commit.clearRemoteStream()
  },

  async joinVoiceChannel(context, room: string) {
    const { state, commit, dispatch, rootState } = rtcActionContext(context)

    while (!client) {
      await dispatch.establishConnection()
    }

    await dispatch.initializeMixer()
    if (!state.mixer) {
      return
    }
    dispatch.startTalkStateUpdate()

    client.addEventListener('userjoin', e => {
      const userId = e.detail.userId
      /* eslint-disable-next-line no-console */
      console.log(`[RTC] User joined, ID: ${userId}`)
      state.mixer?.playFileSource('qall_joined')
    })

    client.addEventListener('userleave', async e => {
      const userId = e.detail.userId
      /* eslint-disable-next-line no-console */
      console.log(`[RTC] User left, ID: ${userId}`)
      commit.removeRemoteStream(userId)

      if (state.mixer) {
        await state.mixer.removeStream(userId)
        state.mixer.playFileSource('qall_left')
      }
    })

    client.addEventListener('streamchange', async e => {
      const stream = e.detail.stream
      const userId = stream.peerId
      /* eslint-disable-next-line no-console */
      console.log(`[RTC] Recieved stream from ${stream.peerId}`)
      commit.addRemoteStream({ userId, mediaStream: stream })

      if (state.mixer) {
        await wait(1000)
        await state.mixer.addStream(stream.peerId, stream)
      }
      commit.setUserVolume({ userId, volume: 0.5 })
    })

    const localStream = await getUserAudio(
      rootState.app.rtcSettings.audioInputDeviceId
    )
    commit.setLocalStream(localStream)

    if (state.isMicMuted) {
      dispatch.mute()
    } else {
      dispatch.unmute()
    }

    await client.joinRoom(room, localStream)

    state.mixer.playFileSource('qall_start')
  },
  mute(context) {
    const { state, commit, rootGetters, rootDispatch } = rtcActionContext(
      context
    )
    const qallSession = rootGetters.domain.rtc.qallSession
    if (!state.localStream || !qallSession) {
      return
    }
    commit.muteLocalStream()
    const statesSet = new Set(qallSession.states)
    statesSet.add('micmuted')
    rootDispatch.domain.rtc.modifyRTCSession({
      sessionId: qallSession.sessionId,
      states: [...statesSet]
    })
  },
  unmute(context) {
    const { state, commit, rootGetters, rootDispatch } = rtcActionContext(
      context
    )
    const qallSession = rootGetters.domain.rtc.qallSession
    if (!state.localStream || !qallSession) {
      return
    }
    commit.unmuteLocalStream()
    const stateSet = new Set(qallSession.states)
    stateSet.delete('micmuted')
    rootDispatch.domain.rtc.modifyRTCSession({
      sessionId: qallSession.sessionId,
      states: [...stateSet]
    })
  },

  startTalkStateUpdate(context) {
    updateTalkingUserState(context)
  },
  stopTalkStateUpdate(context) {
    const { state } = rtcActionContext(context)
    clearInterval(state.talkingStateUpdateId)
  },

  // ---- Specific RTC Session ---- //
  async startQall(context, channelId: ChannelId) {
    const { dispatch } = rtcActionContext(context)
    if (!(await dispatch.ensureDevicePermission())) {
      return
    }

    const { sessionId } = await dispatch.startOrJoinRTCSession({
      channelId,
      sessionType: 'qall'
    })
    dispatch.joinVoiceChannel(sessionId)
  },

  async endQall(context) {
    const { dispatch, rootGetters, rootDispatch } = rtcActionContext(context)
    const qallSession = rootGetters.domain.rtc.qallSession
    if (!qallSession) {
      throw 'something went wrong'
    }
    await dispatch.closeConnection()
    rootDispatch.domain.rtc.removeRTCSession({
      sessionId: qallSession.sessionId
    })

    tts.stop()
  }
})

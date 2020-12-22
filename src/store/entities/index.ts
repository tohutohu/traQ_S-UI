import { defineModule } from 'direct-vuex'
import { state } from './state'
import { getters } from './getters'
import { mutations } from './mutations'
import { actions } from './actions'
import { messages } from './messages'
import { listeners } from './listeners'
import { mitt } from '@/lib/typedMitt'
import { Channel } from '@traptitech/traq'

export const entities = defineModule({
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
  modules: {
    messages
  }
})
listeners()

type EntityEventMap = {
  setChannels: () => void
  addChannel: (channel: Channel) => void
  updateChannel: (data: { newChannel: Channel; oldChannel: Channel }) => void
}

export const entityMitt = mitt<EntityEventMap>()

<template>
  <div :class="$style.container">
    <template v-if="!isMobile">
      <header-tools-item
        v-if="isQallEnabled"
        icon-mdi
        :icon-name="qallIconName"
        :class="$style.qallIcon"
        :disabled="
          isArchived ||
          (hasActiveQallSession &&
            (!isJoinedQallSession || !isJoinedWithCurrentDevice))
        "
        :data-is-active="$boolAttr(isQallSessionOpened)"
        :data-is-joined="$boolAttr(isJoinedQallSession)"
        :tooltip="
          isJoinedQallSession && !isJoinedWithCurrentDevice
            ? '別のデバイスでQall中'
            : undefined
        "
        @toggle="emit('click-qall')"
      />
      <header-tools-item
        v-if="isForcedChannel"
        :class="$style.notificationIcon"
        data-state="forced"
        icon-name="forced"
        disabled
        tooltip="強制通知チャンネル"
      />
      <header-tools-item
        v-else-if="
          currentChannelSubscription === ChannelSubscribeLevel.notified
        "
        :class="$style.notificationIcon"
        data-state="notified"
        icon-name="notified"
        tooltip="通知チャンネル"
        @toggle="changeToNextSubscriptionLevel"
      />
      <header-tools-item
        v-else-if="
          currentChannelSubscription === ChannelSubscribeLevel.subscribed
        "
        :class="$style.notificationIcon"
        data-state="subscribed"
        icon-name="subscribed"
        tooltip="未読管理チャンネル"
        @toggle="changeToNextSubscriptionLevel"
      />
      <header-tools-item
        v-else-if="currentChannelSubscription === ChannelSubscribeLevel.none"
        :class="$style.notificationIcon"
        data-state="none"
        icon-name="not-subscribed"
        tooltip="未購読チャンネル"
        @toggle="changeToNextSubscriptionLevel"
      />
    </template>
    <header-tools-item
      v-if="isStared"
      :class="$style.starIcon"
      data-is-stared
      icon-name="star"
      tooltip="お気に入りから外す"
      @toggle="emit('unstar-channel')"
    />
    <header-tools-item
      v-else
      :class="$style.starIcon"
      icon-name="star-outline"
      tooltip="お気に入りに追加する"
      @toggle="emit('star-channel')"
    />
    <!--
    <header-tools-item
      @toggle="emit('click-pin')"
      :class="$style.icon"
      icon-mdi
      icon-name="pin"
    />
    -->
    <div :class="$style.moreButton">
      <div :id="teleportTargetName" :class="$style.popupLocator" />
      <header-tools-item
        :class="$style.icon"
        icon-mdi
        icon-name="dots-horizontal"
        @toggle="emit('click-more')"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import useChannelSubscriptionState from '@/use/channelSubscriptionState'
import HeaderToolsItem from '@/components/Main/MainView/MainViewHeader/MainViewHeaderToolsItem.vue'
import store from '@/store'
import { ChannelSubscribeLevel } from '@traptitech/traq'
import useIsMobile from '@/use/isMobile'

const isSkywayApikeySet = window.traQConfig.skyway !== undefined

export const teleportTargetName = 'header-popup'

export default defineComponent({
  name: 'ChannelViewHeaderTools',
  components: {
    HeaderToolsItem
  },
  props: {
    isStared: { type: Boolean, default: false },
    isForcedChannel: { type: Boolean, default: false },
    hasActiveQallSession: { type: Boolean, default: false },
    isQallSessionOpened: { type: Boolean, default: false },
    isJoinedQallSession: { type: Boolean, default: false },
    isJoinedWithCurrentDevice: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false }
  },
  setup(props, { emit }) {
    const {
      changeToNextSubscriptionLevel,
      currentChannelSubscription
    } = useChannelSubscriptionState()

    const isQallEnabled = computed(
      () => isSkywayApikeySet && store.state.app.rtcSettings.isEnabled
    )

    const qallIconName = computed(() =>
      props.isJoinedQallSession ? 'phone' : 'phone-outline'
    )

    const { isMobile } = useIsMobile()

    return {
      qallIconName,
      emit,
      currentChannelSubscription,
      changeToNextSubscriptionLevel,
      teleportTargetName,
      isQallEnabled,
      ChannelSubscribeLevel,
      isMobile
    }
  }
})
</script>

<style lang="scss" module>
.container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
}
.moreButton {
  position: relative;
  display: inline;
}
.popupLocator {
  position: absolute;
  right: 0;
  top: 100%;
}
.qallIcon {
  transition: transform 0.1s;
  &[data-is-active] {
    color: $common-ui-qall;
  }
  &[data-is-joined] {
    animation: shake 0.2s 2;
  }
  &:hover {
    transform: scale(1.1);
  }
}
.notificationIcon {
  transition: transform 0.1s;
  &[data-state='notified'] {
    animation: shake 0.2s 2;
  }
  &:hover {
    transform: scale(1.1);
  }
}
.starIcon {
  transition: transform 0.1s;
  &[data-is-stared] {
    animation: spinAndPress 0.5s;
  }
  &:hover {
    transform: scale(1.1);
  }
}
.icon {
  transition: transform 0.1s;
  &:hover {
    transform: scale(1.1);
  }
}

@keyframes shake {
  0% {
    transform: scale(1.1) rotate(0deg);
  }
  25% {
    transform: scale(1.1) rotate(-10deg);
  }
  75% {
    transform: scale(1.1) rotate(10deg);
  }
  100% {
    transform: scale(1.1) rotate(0deg);
  }
}

@keyframes spinAndPress {
  0% {
    transform: scale(1.1) rotate(0deg);
  }
  60% {
    transform: scale(1.1) rotate(360deg);
  }
  80% {
    transform: scale(1.3) rotate(360deg);
  }
  100% {
    transform: scale(1.1) rotate(360deg);
  }
}
</style>

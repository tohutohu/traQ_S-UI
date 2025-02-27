<template>
  <div :class="$style.container">
    <navigation-content-container
      v-if="usersWithNotification.length > 0"
      subtitle="未読ダイレクトメッセージ"
    >
      <div :class="$style.dmActivity">
        <d-m-activity-element
          v-for="user in usersWithNotification"
          :key="user.id"
          :user-id="user"
          :class="$style.dmActivityElement"
        />
      </div>
    </navigation-content-container>
    <navigation-content-container subtitle="ユーザーリスト">
      <filter-input v-model="userListFilterState.query" on-secondary />
      <div v-if="userListFilterState.query.length > 0" :class="$style.list">
        <users-element
          v-for="user in userListFilterState.filteredItems"
          :key="user.id"
          :user="user"
          :class="$style.element"
        />
      </div>
      <template v-else>
        <users-grade-list
          v-for="userList in userLists"
          :key="userList.gradeName"
          :name="userList.gradeName"
          :users="userList.users"
          :class="$style.list"
        />
      </template>
    </navigation-content-container>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import store from '@/store'
import { compareStringInsensitive } from '@/lib/util/string'
import NavigationContentContainer from '@/components/Main/Navigation/NavigationContentContainer.vue'
import UsersElement from './UsersElement.vue'
import UsersGradeList from './UsersGradeList.vue'
import FilterInput from '@/components/UI/FilterInput.vue'
import useTextFilter from '@/use/textFilter'
import { isDefined } from '@/lib/util/array'
import { ActiveUser } from '@/lib/user'
import DMActivityElement from './DMActivityElement.vue'

const useUsersWithNotification = () => {
  const usersWithNotification = computed(() =>
    [...store.state.domain.me.unreadChannelsMap.values()]
      .sort((a, b) =>
        Date.parse(a.updatedAt) > Date.parse(b.updatedAt) ? -1 : 1
      )
      .map(unread =>
        store.state.entities.dmChannelsMap.get(unread.channelId ?? '')
      )
      .filter(isDefined)
      .map(({ userId }) => userId)
  )
  return usersWithNotification
}

interface UsersGradeList {
  gradeName: string
  users: ActiveUser[]
}

const useListByGradeName = () => {
  const userGroups = computed(() => store.getters.entities.gradeGroups)
  const activeUsersMap = computed(() => store.getters.entities.activeUsersMap)
  const listByGradeName = computed((): UsersGradeList[] => {
    if (userGroups.value.length === 0 || activeUsersMap.value.size === 0) {
      return []
    }
    const userGrades: UsersGradeList[] = []
    const categorized = new Set<string>()

    // 学年グループ
    for (const group of userGroups.value) {
      const member = group.members
        .map(member => activeUsersMap.value.get(member.id))
        .filter(isDefined)
        .sort((u1, u2) => compareStringInsensitive(u1.name, u2.name))
      if (member.length === 0) continue // グループ内にメンバーが居ない場合は非表示

      userGrades.push({ gradeName: group.name, users: member })

      member.map(user => user.id).forEach(id => categorized.add(id))
    }

    // BOTグループ
    const bots = [...activeUsersMap.value.values()]
      .filter(user => user.bot)
      .sort((u1, u2) => compareStringInsensitive(u1.name, u2.name))
    bots.map(user => user.id).forEach(id => categorized.add(id))

    // その他グループ
    const others = [...activeUsersMap.value.values()]
      .filter(user => !categorized.has(user.id))
      .sort((u1, u2) => compareStringInsensitive(u1.name, u2.name))

    const result = [
      ...userGrades.sort(
        (e1, e2) => compareStringInsensitive(e1.gradeName, e2.gradeName, true) // 学年なので逆順
      )
    ]
    if (others.length > 0) result.push({ gradeName: 'Others', users: others })
    if (bots.length > 0) result.push({ gradeName: 'BOT', users: bots })

    return result
  })
  return listByGradeName
}

const useUserListFilter = () => {
  const activeUsers = computed(() => [
    ...store.getters.entities.activeUsersMap.values()
  ])
  const { textFilterState } = useTextFilter(activeUsers, 'name')
  return {
    userListFilterState: textFilterState
  }
}

export default defineComponent({
  name: 'Users',
  components: {
    DMActivityElement,
    NavigationContentContainer,
    UsersElement,
    UsersGradeList,
    FilterInput
  },
  setup() {
    const usersWithNotification = useUsersWithNotification()
    const userLists = useListByGradeName()
    const { userListFilterState } = useUserListFilter()
    return {
      usersWithNotification,
      userLists,
      userListFilterState
    }
  }
})
</script>

<style lang="scss" module>
.container {
  padding: 0 16px 0 0;
}
.dmActivity {
  margin-bottom: 8px;
}
.dmActivityElement {
  margin: 8px 0;
  &:first-child {
    margin-top: 0;
  }
  &:last-child {
    margin-bottom: 0;
  }
}
.element {
  margin: 8px 0;
}
.list {
  margin: 16px 0px;
}
</style>

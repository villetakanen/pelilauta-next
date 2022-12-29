import { doc, getFirestore, onSnapshot, updateDoc } from 'firebase/firestore'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSession } from '../useSession'

export * from './metaPages'

export interface StreamData {
    slug: string
    name: string
    icon: string
    count: number
    order: number
    description: string
  }

let _init = false
const streams = ref(new Map<string, StreamData>())

export interface SiteFamily {
  name: string
  icon: string
  id: string
}
const siteThemes = ref<SiteFamily[]>([])

const licenses = computed(() => {
  const { t } = useI18n()
  return [
    { label: t('fields.asset.licenses.0'), value: '0' },
    { label: t('fields.asset.licenses.1'), value: '1' },
    { label: t('fields.asset.licenses.2'), value: '2' },
    { label: t('fields.asset.licenses.3'), value: '3' },
  ]
})

function init () {
  if (_init) return
  _init = true
  onSnapshot(
    doc(getFirestore(), 'meta', 'pelilauta'),
    (snapshot) => {
      const data = snapshot.data()
      if (data) {
        if (data.admins) admins.value = data.admins
        if (data.frozen) frozen.value = data.frozen
        siteThemes.value = data.sitethemes || []
      }
      for (const key in snapshot.data()?.streams) {
        if(key === '-') continue // skip the '-' key as it's reserved for unassigned streams
        const stream = snapshot.data()?.streams[key]
        streams.value.set(key, stream)
      }
    }
  )
}

const admins = ref<string[]>([])
const frozen = ref<string[]>([])

async function saveStreams (arr:StreamData[]) {
  const { admin } = useSession()
  if (!admin.value) throw new Error('Requires admin access to DB, aborting at client side')
  const map:Record<string, StreamData> = {}
  arr.forEach((stream, index) => {
    const data = {
      name: stream.name,
      order: index,
      count: stream.count,
      slug: stream.slug,
      icon: stream.icon || 'fox',
      description: stream.description || ''
    }
    map[stream.name] = data
  })
  return updateDoc(
    doc(
      getFirestore(),
      'meta',
      'pelilauta'
    ),
    { streams: map }
  )
}

export function useMeta () {
  init()
  return {
    streams: computed(() => Array.from(streams.value.values()).sort((a,b) => a.order > b.order ? 1 : -1)),
    admins: computed(() => admins.value),
    frozen: computed(() => frozen.value),
    siteThemes: computed(() => siteThemes.value),
    saveStreams,
    licenses
  }
}
import { Thread } from "@11thdeg/skaldstore"
import { collection, doc, getDoc, getFirestore, limit, onSnapshot, orderBy, query, where } from "firebase/firestore"
import { computed, ref } from "vue"
import { logDebug, logEvent } from "../utils/logHelpers"
import { addStore } from "./useSession"

let _init = false
let unsubscribeThreads:undefined|CallableFunction
const threadCache = ref(new Map<string, Thread>())

async function init () {
  logDebug('init threads', _init)
  if (_init) return
  _init = true
  addStore("threads", reset)
  if(unsubscribeThreads) unsubscribeThreads()
  unsubscribeThreads = await onSnapshot(
    query(
        collection(
          getFirestore(),
          'stream'
        ),
        limit(11),
        where('public', '==', true),
        orderBy('flowTime', 'desc')
    ),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if(change.type === 'removed') {
          threadCache.value.delete(change.doc.id)
        } else {
          logDebug('thread', change.doc.data()?.title)
          threadCache.value.set(change.doc.id, new Thread(change.doc.data(), change.doc.id))
        }
      })
    }
  )
  logEvent('stream', {action: 'subscribed', where: 'public'})
}

function reset () {
  if (unsubscribeThreads) unsubscribeThreads()
  threadCache.value = new Map<string, Thread>()
  _init = false
}

export async function fetchThread (key:string) {
  if (!threadCache.value.has(key)) {
    return threadCache.value.get(key)
  }
  const document = await getDoc(
    doc(getFirestore(), 'stream', key)
  )
  if (document.exists()) {
    const thread = new Thread(document.data(), key)
    threadCache.value.set(key, thread)
    return thread
  }
  return undefined
}

export function useThreads () {
    init()
    return {
        recent: computed(() => {
          const arr = Array.from(threadCache.value.values())
          if (arr.length > 11) arr.length = 11
          arr.sort((a, b) => a.compareFlowTime(b))
            return arr
        }),
        threadCache: computed(() => threadCache.value)
    }
}
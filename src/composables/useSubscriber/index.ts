import { Subscriber } from '@11thdeg/skaldstore'
import { doc, getDoc, getFirestore, onSnapshot } from '@firebase/firestore'
import { computed, ref } from 'vue'
import { setStorable, updateStorable } from '../../utils/firestoreHelpers'
import { logEvent } from '@firebase/analytics'

/* STATE MANAGEMENT STARTS ******************/

const uid = ref('')
const subscriber = ref(new Subscriber('-'))
const initialized = ref(false)
let _unsubscribe: () => void

async function subscriberExists(newUid: string): Promise<boolean> {
  const dbdoc = await getDoc(
    doc(
      getFirestore(),
      Subscriber.collectionName,
      newUid
    )
  )
  return dbdoc.exists()
}

async function createSubscriber(newUid: string): Promise<void> {
  const sub = new Subscriber(newUid)
  sub.allSeenAt = Date.now() * 1000
  await setStorable(sub)
  logEvent(getFirestore(), 'create_subscriber', { uid: newUid })
  return
}

async function subscribeToSubscriber(newUid: string): Promise<void> {
  _unsubscribe = onSnapshot(
    doc(
      getFirestore(),
      Subscriber.collectionName,
      newUid
    ),
    (snapshot) => {
      if (snapshot.exists()) {
        subscriber.value = new Subscriber(newUid, snapshot.data())
      }
    }
  )
}

/**
 * A function that initializes a subscriber object for the current user.
 *
 * @param {string} uid The user id of the current user.
 */
export async function initSubscriber(newUid: string) {
  if (uid.value === newUid) throw new Error('Subscriber already initialized.')
  _unsubscribe?.()
  initialized.value = false
  uid.value = newUid

  subscriber.value = new Subscriber(uid.value)

  // The user might not have a subscriber object yet, so we create one.
  if (!(await subscriberExists(newUid))) {
    await createSubscriber(newUid)
  }

  // Subscribe to the subscriber object.
  await subscribeToSubscriber(newUid)
  
  initialized.value = true
}

/* SUBSCRIBER FUNCTIONALITY STARTS ******************/

function watches(key: string|undefined) {
  if (!key) return false
  if (!subscriber.value) return false
  return subscriber.value.watches(key) > 0
}

function mute(key: string) {
  if (!subscriber.value) throw new Error('Subscriber not initialized')
  subscriber.value.addMute(key)
  updateStorable(subscriber.value)
}

function subscribeTo(key: string) {
  if (!subscriber.value) throw new Error('Subscriber not initialized')
  subscriber.value.addWatch(key, Date.now() * 1000)
  updateStorable(subscriber.value)
}

function setSeen(key: string) {
  if (!subscriber.value) throw new Error('Subscriber not initialized')
  subscriber.value.markSeen(key, Date.now() * 1000)
  updateStorable(subscriber.value)
}

function markAllSeen() {
  if (!subscriber.value) throw new Error('Subscriber not initialized')
  subscriber.value.allSeenAt = Date.now() * 1000
  updateStorable(subscriber.value)
}

/* COMPOSABLE STARTS ******************/

/**
 * A composable function that returns a subscriber object for the current user.
 */
export function useSubscriber() {
  return {
    uid: computed(() => uid.value),
    subscriber: computed(() => subscriber.value),
    loading: computed(() => !initialized.value),
    watches,
    mute,
    subscribeTo,
    setSeen,
    markAllSeen
  }
}
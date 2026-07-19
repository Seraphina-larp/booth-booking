import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

const PUBLIC_BOOKING_FIELDS = [
  'id', 'category', 'date', 'roomId', 'venueName', 'activityName',
  'slots', 'slot', 'timeStart', 'timeEnd',
];

function pick(source, fields) {
  return fields.reduce((result, field) => {
    if (source[field] !== undefined) result[field] = source[field];
    return result;
  }, {});
}

export function toPublicBooking(booking) {
  return pick(booking, PUBLIC_BOOKING_FIELDS);
}

export async function loadPublicData() {
  const [roomsSnap, textsSnap, bookingSnap] = await Promise.all([
    getDoc(doc(db, 'publicConfig', 'rooms')),
    getDoc(doc(db, 'publicConfig', 'pageTexts')),
    getDocs(collection(db, 'publicBookings')),
  ]);
  return {
    rooms: roomsSnap.exists() ? roomsSnap.data().value : null,
    pageTexts: textsSnap.exists() ? textsSnap.data().value : {},
    bookings: bookingSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
  };
}

export async function loadProfile(uid) {
  const snap = await getDoc(doc(db, 'profiles', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function loadAdminData() {
  const [bookingSnap, applicationSnap, feedbackSnap, staffSnap, accessRequestSnap, privateConfigSnap] = await Promise.all([
    getDocs(collection(db, 'bookings')),
    getDocs(collection(db, 'applications')),
    getDocs(collection(db, 'feedback')),
    getDocs(collection(db, 'staffProfiles')),
    getDocs(collection(db, 'accessRequests')),
    getDoc(doc(db, 'privateConfig', 'app')),
  ]);
  const config = privateConfigSnap.exists() ? privateConfigSnap.data() : {};
  return {
    bookings: bookingSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
    pending: applicationSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
    feedback: feedbackSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
    staffProfiles: staffSnap.docs.map((item) => ({ uid: item.id, ...item.data() })),
    accessRequests: accessRequestSnap.docs.map((item) => ({ uid: item.id, ...item.data() })),
    reminderLog: config.reminderLog || {},
    syncConfig: config.syncConfig || {},
  };
}

export function subscribeApplications(onChange, onError) {
  return onSnapshot(collection(db, 'applications'), (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}

export async function loadStaffBookings(uid) {
  const snap = await getDocs(collection(db, 'staffViews', uid, 'bookings'));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function staffViewFor(booking, staffUid, staffName) {
  const isRentalPartner = booking.rentalPartnerUid === staffUid;
  return {
    ...pick(booking, [
      'id', 'category', 'date', 'roomId', 'venueName', 'activityName', 'slots', 'slot',
      'timeStart', 'timeEnd', 'hostNote', 'notes', 'paymentStatus',
    ]),
    personName: booking.personName || '',
    hosts: (booking.hosts || []).map((host) => ({
      id: host.id || '',
      name: host.name || '',
      role: host.role || '',
      ...(host.staffUid === staffUid ? { wage: host.wage ?? '', wagePaid: host.wagePaid || 'unpaid' } : {}),
    })),
    feeType: isRentalPartner ? (booking.feeType ?? '') : '',
    feeRate: isRentalPartner ? (booking.feeRate ?? '') : '',
    feeHours: isRentalPartner ? (booking.feeHours ?? '') : '',
    feeRevenue: isRentalPartner ? (booking.feeRevenue ?? '') : '',
    feePercentage: isRentalPartner ? (booking.feePercentage ?? '') : '',
    feeManualAmount: isRentalPartner ? (booking.feeManualAmount ?? '') : '',
  };
}

export async function submitAccessRequest(request) {
  await setDoc(doc(db, 'accessRequests', request.uid), request);
}

export async function approveAccessRequest(request, displayName) {
  const profile = {
    uid: request.uid,
    displayName,
    email: request.email || '',
  };
  await saveStaffProfile(profile);
  await setDoc(doc(db, 'accessRequests', request.uid), {
    ...request,
    displayName,
    status: 'approved',
    approvedAt: new Date().toISOString(),
  });
  return profile;
}

export async function saveBookingSecure(booking, previousStaffUids = []) {
  const staffUids = Array.from(new Set([
    ...(booking.hosts || []).map((host) => host.staffUid).filter(Boolean),
    booking.rentalPartnerUid,
  ].filter(Boolean)));
  const canonical = { ...booking, staffUids };
  const batch = writeBatch(db);
  batch.set(doc(db, 'bookings', booking.id), canonical);
  batch.set(doc(db, 'publicBookings', booking.id), toPublicBooking(booking));
  staffUids.forEach((staffUid) => {
    batch.set(
      doc(db, 'staffViews', staffUid, 'bookings', booking.id),
      staffViewFor(canonical, staffUid, ''),
    );
  });
  previousStaffUids.filter((uid) => !staffUids.includes(uid)).forEach((staffUid) => {
    batch.delete(doc(db, 'staffViews', staffUid, 'bookings', booking.id));
  });
  await batch.commit();
  return canonical;
}

export async function deleteBookingSecure(booking) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'bookings', booking.id));
  batch.delete(doc(db, 'publicBookings', booking.id));
  (booking.staffUids || []).forEach((staffUid) => {
    batch.delete(doc(db, 'staffViews', staffUid, 'bookings', booking.id));
  });
  await batch.commit();
}

export async function submitApplication(application) {
  await setDoc(doc(db, 'applications', application.id), application);
}

export async function saveApplication(application) {
  await setDoc(doc(db, 'applications', application.id), application);
}

export async function submitFeedback(feedback) {
  await setDoc(doc(db, 'feedback', feedback.id), feedback);
}

export async function saveFeedback(feedback) {
  await setDoc(doc(db, 'feedback', feedback.id), feedback);
}

export async function saveStaffProfile(profile) {
  await Promise.all([
    setDoc(doc(db, 'staffProfiles', profile.uid), profile),
    setDoc(doc(db, 'profiles', profile.uid), {
      role: 'staff',
      displayName: profile.displayName,
      email: profile.email || '',
    }),
  ]);
}

export async function deleteStaffProfile(uid) {
  await Promise.all([
    deleteDoc(doc(db, 'staffProfiles', uid)),
    deleteDoc(doc(db, 'profiles', uid)),
  ]);
}

export async function savePublicConfig(rooms, pageTexts) {
  await Promise.all([
    setDoc(doc(db, 'publicConfig', 'rooms'), { value: rooms }),
    setDoc(doc(db, 'publicConfig', 'pageTexts'), { value: pageTexts }),
  ]);
}

export async function savePrivateConfig(data) {
  await setDoc(doc(db, 'privateConfig', 'app'), data, { merge: true });
}

export async function loadLegacyData() {
  const keys = [
    'rooms-config', 'bookings', 'pending-requests', 'staff-directory',
    'host-feedback', 'reminder-log', 'page-texts', 'sync-config',
  ];
  const snapshots = await Promise.all(keys.map((key) => getDoc(doc(db, 'appData', key))));
  return keys.reduce((result, key, index) => {
    result[key] = snapshots[index].exists() ? snapshots[index].data().value : null;
    return result;
  }, {});
}

export async function migrateLegacyData(legacy) {
  const rooms = legacy['rooms-config'] || [];
  const pageTexts = legacy['page-texts'] || {};
  await savePublicConfig(rooms, pageTexts);
  for (const booking of (legacy.bookings || [])) {
    await saveBookingSecure(booking);
  }
  for (const application of (legacy['pending-requests'] || [])) {
    await saveApplication(application);
  }
  for (const item of (legacy['host-feedback'] || [])) {
    await saveFeedback(item);
  }
  await savePrivateConfig({
    reminderLog: legacy['reminder-log'] || {},
    syncConfig: legacy['sync-config'] || {},
    migratedAt: new Date().toISOString(),
  });
}

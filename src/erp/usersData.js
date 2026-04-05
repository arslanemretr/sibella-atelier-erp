import { readPersistentStore, writePersistentStore } from "./serverStore";

const STORAGE_KEY = "sibella.erp.users.v1";

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function seedUsers() {
  return [
    {
      id: "usr-001",
      fullName: "Sibel Ersoy Arslan",
      email: "sibel@sibella.com",
      password: "Sibella123!",
      role: "Yonetici",
      status: "Aktif",
      lastLoginAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "usr-002",
      fullName: "Magaza Personeli",
      email: "magaza@sibella.com",
      password: "Magaza123!",
      role: "Magaza",
      status: "Aktif",
      lastLoginAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "usr-003",
      fullName: "Muhasebe",
      email: "muhasebe@sibella.com",
      password: "Muhasebe123!",
      role: "Muhasebe",
      supplierId: null,
      status: "Aktif",
      lastLoginAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "usr-004",
      fullName: "Mina Aksesuar Portal",
      email: "mina.portal@sibella.com",
      password: "Portal123!",
      role: "Tedarikci",
      supplierId: "sup-001",
      status: "Aktif",
      lastLoginAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];
}

function loadStore() {
  const parsed = readPersistentStore(STORAGE_KEY, seedUsers());
  const mergedByEmail = new Map(parsed.map((item) => [String(item.email || "").toLowerCase(), item]));

  seedUsers().forEach((seededUser) => {
    const key = String(seededUser.email || "").toLowerCase();
    if (!mergedByEmail.has(key)) {
      mergedByEmail.set(key, seededUser);
    }
  });

  const mergedUsers = Array.from(mergedByEmail.values());
  writePersistentStore(STORAGE_KEY, mergedUsers);
  return mergedUsers;
}

function saveStore(records) {
  writePersistentStore(STORAGE_KEY, records);
}

function normalizeUser(values, existingUser) {
  return {
    id: existingUser?.id || createId("usr"),
    fullName: values.fullName || "",
    email: values.email || "",
    password: values.password || existingUser?.password || "ChangeMe123!",
    role: values.role || "Magaza",
    supplierId: values.supplierId || null,
    status: values.status || "Aktif",
    lastLoginAt: existingUser?.lastLoginAt || null,
    createdAt: existingUser?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

export function listUsers() {
  return loadStore();
}

export function getUserById(userId) {
  return loadStore().find((item) => item.id === userId) || null;
}

export function createUser(values) {
  const store = loadStore();
  const record = normalizeUser(values);
  saveStore([record, ...store]);
  return record;
}

export function updateUser(userId, values) {
  const store = loadStore();
  const existingUser = store.find((item) => item.id === userId);
  if (!existingUser) {
    return null;
  }

  const updated = normalizeUser(values, existingUser);
  saveStore(store.map((item) => (item.id === userId ? updated : item)));
  return updated;
}

export function deleteUser(userId) {
  const store = loadStore();
  saveStore(store.filter((item) => item.id !== userId));
}

export function authenticateUser(email, password) {
  const user = loadStore().find(
    (item) =>
      item.email?.toLowerCase() === String(email || "").toLowerCase() &&
      item.password === password &&
      item.status === "Aktif",
  );

  if (!user) {
    return null;
  }

  const updatedUser = {
    ...user,
    lastLoginAt: nowIso(),
    updatedAt: nowIso(),
  };

  saveStore(loadStore().map((item) => (item.id === user.id ? updatedUser : item)));
  return updatedUser;
}

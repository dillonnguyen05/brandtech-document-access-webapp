import {
  collection,
  onSnapshot,
  query,
  where
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { apiRequest } from "./apiClient.js";

export function listenToActiveCustomers(onCustomers, onError) {
  const customersQuery = query(
    collection(db, "users"),
    where("status", "==", "active")
  );

  return onSnapshot(
    customersQuery,
    (snapshot) => {
      const customers = snapshot.docs
        .map((customerSnapshot) => ({
          id: customerSnapshot.id,
          ...customerSnapshot.data()
        }))
        .filter((customer) => customer.role === "customer")
        .sort((a, b) => (a.company || "").localeCompare(b.company || "") || (a.name || "").localeCompare(b.name || ""));

      onCustomers(customers);
    },
    onError
  );
}

export async function loadPendingCustomers() {
  const result = await apiRequest("/api/admin/users/pending");
  return result.users;
}

function reviewCustomer(userId, action, message = "") {
  return apiRequest(
    `/api/admin/users/${encodeURIComponent(userId)}/${action}`,
    {
      method: "POST",
      body: JSON.stringify({ message })
    }
  );
}

export function approveCustomer(userId) {
  return reviewCustomer(userId, "approve");
}

export function denyCustomer(userId, message) {
  return reviewCustomer(userId, "deny", message);
}

export function revokeCustomer(userId, message) {
  return reviewCustomer(userId, "revoke", message);
}

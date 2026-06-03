import {
  collection,
  onSnapshot,
  query,
  where
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

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

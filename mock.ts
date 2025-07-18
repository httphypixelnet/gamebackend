import { prisma } from ".";
import { z } from "zod";
const res = await fetch("https://dummyjson.com/users");
const data = await res.json();
export const schema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  maidenName: z.string(),
  age: z.number(),
  gender: z.string(),
  email: z.string(),
  phone: z.string(),
  username: z.string(),
  password: z.string(),
  birthDate: z.string(),
  image: z.string(),
  bloodGroup: z.string(),
  height: z.number(),
  weight: z.number(),
  eyeColor: z.string(),
  hair: z.object({ color: z.string(), type: z.string() }),
  ip: z.string(),
  address: z.object({
    address: z.string(),
    city: z.string(),
    state: z.string(),
    stateCode: z.string(),
    postalCode: z.string(),
    coordinates: z.object({ lat: z.number(), lng: z.number() }),
    country: z.string(),
  }),
  macAddress: z.string(),
  university: z.string(),
  bank: z.object({
    cardExpire: z.string(),
    cardNumber: z.string(),
    cardType: z.string(),
    currency: z.string(),
    iban: z.string(),
  }),
  company: z.object({
    department: z.string(),
    name: z.string(),
    title: z.string(),
    address: z.object({
      address: z.string(),
      city: z.string(),
      state: z.string(),
      stateCode: z.string(),
      postalCode: z.string(),
      coordinates: z.object({ lat: z.number(), lng: z.number() }),
      country: z.string(),
    }),
  }),
  ein: z.string(),
  ssn: z.string(),
  userAgent: z.string(),
  crypto: z.object({
    coin: z.string(),
    wallet: z.string(),
    network: z.string(),
  }),
  role: z.string(),
});
let counter = 0;
const actualSchema = z.object({ users: z.array(schema) });
try {
  const dat = actualSchema.parse(data);
  // Create mock users in the database
  for (const user of dat.users) {
    counter += 1;
    const parsedUser = schema.safeParse(user);
    if (!parsedUser.success) {
      console.error("Invalid user data:", parsedUser.error);
      continue;
    }
    await prisma.user.create({
      data: {
        name: user.username,
        id: counter,
        score: Math.floor(Math.random() * 100), // Random score
      },
    });
  }
} catch (error) {
  console.error("Data validation error:", error);
}
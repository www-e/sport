import { DefaultSession } from "next-auth"
import { UserRole } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      role: UserRole
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    username: string
    email: string
    name: string
    role: UserRole
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole
    username?: string
  }
}

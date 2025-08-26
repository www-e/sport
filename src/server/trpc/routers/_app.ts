import { createTRPCRouter } from '../init'
import { authRouter } from './auth'
import { adminRouter } from './admin'
import { professorRouter } from './professor'
import { studentRouter } from './student'
import { uploadRouter } from './upload'
import { couponsRouter } from './coupons'

export const appRouter = createTRPCRouter({
  auth: authRouter,
  admin: adminRouter,
  professor: professorRouter,
  student: studentRouter,
  upload: uploadRouter,
  coupons: couponsRouter,
})

export type AppRouter = typeof appRouter

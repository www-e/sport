import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'football-soccer' },
      update: {},
      create: {
        name: 'Football/Soccer',
        slug: 'football-soccer',
        description: 'Football/Soccer training courses and techniques',
        icon: '⚽',
        color: '#10b981'
      }
    }),
    prisma.category.upsert({
      where: { slug: 'basketball' },
      update: {},
      create: {
        name: 'Basketball',
        slug: 'basketball',
        description: 'Basketball fundamentals and advanced techniques',
        icon: '🏀',
        color: '#f59e0b'
      }
    }),
    prisma.category.upsert({
      where: { slug: 'tennis' },
      update: {},
      create: {
        name: 'Tennis',
        slug: 'tennis',
        description: 'Tennis training from beginner to professional',
        icon: '🎾',
        color: '#ef4444'
      }
    }),
    prisma.category.upsert({
      where: { slug: 'fitness' },
      update: {},
      create: {
        name: 'Fitness & Training',
        slug: 'fitness',
        description: 'General fitness and strength training',
        icon: '💪',
        color: '#8b5cf6'
      }
    }),
    prisma.category.upsert({
      where: { slug: 'swimming' },
      update: {},
      create: {
        name: 'Swimming',
        slug: 'swimming',
        description: 'Swimming techniques and water sports',
        icon: '🏊',
        color: '#06b6d4'
      }
    })
  ])

  console.log('✅ Categories created')

  // Create sample users
  const hashedPassword = await bcrypt.hash('password123', 12)
  
  const sampleUsers = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@sportology.com' },
      update: {},
      create: {
        username: 'admin_' + Date.now(),
        email: 'admin@sportology.com',
        password: hashedPassword,
        name: 'Admin User',
        phone: '+201000000001',
        role: 'PROFESSOR', // Give admin professor role for now
        verified: true
      }
    }),
    prisma.user.upsert({
      where: { email: 'professor@sportology.com' },
      update: {},
      create: {
        username: 'professor_' + Date.now(),
        email: 'professor@sportology.com',
        password: hashedPassword,
        name: 'John Professor',
        phone: '+201000000002',
        role: 'PROFESSOR',
        verified: true
      }
    }),
    prisma.user.upsert({
      where: { email: 'student@sportology.com' },
      update: {},
      create: {
        username: 'student_' + Date.now(),
        email: 'student@sportology.com',
        password: hashedPassword,
        name: 'Jane Student',
        phone: '+201000000003',
        role: 'STUDENT',
        verified: true
      }
    })
  ])

  console.log('✅ Sample users created')

  // Create sample courses
  const sampleCourses = await Promise.all([
    prisma.course.upsert({
      where: { slug: 'football-fundamentals' },
      update: {},
      create: {
        title: 'Football Fundamentals',
        slug: 'football-fundamentals',
        description: 'Learn the basic skills and techniques needed to excel in football. This comprehensive course covers passing, dribbling, shooting, and tactical awareness.',
        price: 99.99,
        difficulty: 'BEGINNER',
        duration: 480, // 8 hours
        language: 'en',
        published: true,
        featured: true,
        isFree: false,
        creatorId: sampleUsers[1].id, // Professor
        categoryId: categories[0].id
      }
    }),
    prisma.course.upsert({
      where: { slug: 'basketball-basics' },
      update: {},
      create: {
        title: 'Basketball Basics',
        slug: 'basketball-basics',
        description: 'Master the fundamentals of basketball including shooting, dribbling, passing, and defense techniques.',
        price: 79.99,
        difficulty: 'BEGINNER',
        duration: 360, // 6 hours
        language: 'en',
        published: true,
        featured: false,
        isFree: false,
        creatorId: sampleUsers[1].id, // Professor
        categoryId: categories[1].id
      }
    }),
    prisma.course.upsert({
      where: { slug: 'tennis-masterclass' },
      update: {},
      create: {
        title: 'Tennis Masterclass',
        slug: 'tennis-masterclass',
        description: 'Advanced tennis techniques and strategies for competitive play. Improve your serve, forehand, backhand, and mental game.',
        price: 149.99,
        difficulty: 'ADVANCED',
        duration: 600, // 10 hours
        language: 'en',
        published: true,
        featured: true,
        isFree: false,
        creatorId: sampleUsers[1].id, // Professor
        categoryId: categories[2].id
      }
    }),
    prisma.course.upsert({
      where: { slug: 'fitness-bootcamp' },
      update: {},
      create: {
        title: 'Fitness Bootcamp',
        slug: 'fitness-bootcamp',
        description: 'High-intensity fitness training program designed to improve strength, endurance, and overall fitness.',
        price: 0,
        difficulty: 'INTERMEDIATE',
        duration: 300, // 5 hours
        language: 'en',
        published: true,
        featured: false,
        isFree: true,
        creatorId: sampleUsers[1].id, // Professor
        categoryId: categories[3].id
      }
    })
  ])

  console.log('✅ Sample courses created')

  // Create sample lessons for each course
  for (let courseIndex = 0; courseIndex < sampleCourses.length; courseIndex++) {
    const course = sampleCourses[courseIndex]
    const lessonCount = 5 + Math.floor(Math.random() * 5) // 5-9 lessons per course
    
    for (let i = 1; i <= lessonCount; i++) {
      await prisma.lesson.create({
        data: {
          title: `${course.title} - Lesson ${i}`,
          description: `This is lesson ${i} of the ${course.title} course.`,
          videoDuration: 300 + Math.floor(Math.random() * 600), // 5-15 minutes
          order: i,
          freePreview: i === 1, // First lesson is free preview
          courseId: course.id
        }
      })
    }
  }

  console.log('✅ Sample lessons created')

  // Create sample enrollments
  await prisma.enrollment.create({
    data: {
      userId: sampleUsers[2].id, // Student
      courseId: sampleCourses[0].id, // Football Fundamentals
      status: 'ACTIVE',
      progress: 25.5
    }
  })

  await prisma.enrollment.create({
    data: {
      userId: sampleUsers[2].id, // Student
      courseId: sampleCourses[3].id, // Free Fitness Bootcamp
      status: 'ACTIVE',
      progress: 80.0
    }
  })

  console.log('✅ Sample enrollments created')

  // Create sample orders and payments
  const order1 = await prisma.order.create({
    data: {
      total: 99.99,
      currency: 'USD',
      status: 'PAID',
      userId: sampleUsers[2].id,
      items: {
        create: {
          price: 99.99,
          courseId: sampleCourses[0].id
        }
      }
    }
  })

  await prisma.payment.create({
    data: {
      amount: 99.99,
      method: 'CARD',
      status: 'SUCCESS',
      orderId: order1.id
    }
  })

  const order2 = await prisma.order.create({
    data: {
      total: 149.99,
      currency: 'USD',
      status: 'PAID',
      userId: sampleUsers[2].id,
      items: {
        create: {
          price: 149.99,
          courseId: sampleCourses[2].id
        }
      }
    }
  })

  await prisma.payment.create({
    data: {
      amount: 149.99,
      method: 'CARD',
      status: 'SUCCESS',
      orderId: order2.id
    }
  })

  console.log('✅ Sample orders and payments created')

  // Create sample coupons
  await prisma.coupon.upsert({
    where: { code: 'WELCOME20' },
    update: {},
    create: {
      code: 'WELCOME20',
      name: 'Welcome Discount',
      description: '20% off for new users',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      maxUses: 100,
      usedCount: 15,
      maxUsesPerUser: 1,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      isActive: true,
      isGlobal: true,
      createdById: sampleUsers[0].id
    }
  })

  await prisma.coupon.upsert({
    where: { code: 'SUMMER50' },
    update: {},
    create: {
      code: 'SUMMER50',
      name: 'Summer Sale',
      description: '$50 off any course',
      discountType: 'FIXED_AMOUNT',
      discountValue: 50,
      maxUses: 50,
      usedCount: 8,
      maxUsesPerUser: 1,
      validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      isActive: true,
      isGlobal: true,
      createdById: sampleUsers[0].id
    }
  })

  console.log('✅ Sample coupons created')

  // Create audit log entries
  await prisma.auditLog.createMany({
    data: [
      {
        action: 'CREATE_COURSE',
        actorId: sampleUsers[1].id,
        actorType: 'PROFESSOR',
        resourceId: sampleCourses[0].id,
        resourceType: 'COURSE',
        metadata: { courseName: sampleCourses[0].title }
      },
      {
        action: 'USER_ENROLLMENT',
        actorId: sampleUsers[2].id,
        actorType: 'STUDENT',
        resourceId: sampleCourses[0].id,
        resourceType: 'ENROLLMENT',
        metadata: { courseName: sampleCourses[0].title, userName: sampleUsers[2].name }
      },
      {
        action: 'CREATE_COUPON',
        actorId: sampleUsers[0].id,
        actorType: 'ADMIN',
        resourceId: 'WELCOME20',
        resourceType: 'COUPON',
        metadata: { couponCode: 'WELCOME20' }
      }
    ]
  })

  console.log('✅ Sample audit logs created')

  console.log('🎉 Database seeding completed successfully!')
  console.log('')
  console.log('Sample accounts created:')
  console.log('📧 admin@sportology.com (password: password123)')
  console.log('📧 professor@sportology.com (password: password123)')
  console.log('📧 student@sportology.com (password: password123)')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
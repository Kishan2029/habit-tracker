import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Habit Tracker API',
      version: '1.0.0',
      description: 'API documentation for the Habit Tracker application',
    },
    servers: [
      {
        url: '/api',
        description: 'API server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            role: { type: 'string', enum: ['user', 'premium', 'admin'], example: 'user' },
            settings: {
              type: 'object',
              properties: {
                theme: { type: 'string', enum: ['light', 'dark', 'system'], example: 'system' },
                timezone: { type: 'string', example: 'UTC' },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Habit: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            userId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            name: { type: 'string', example: 'Morning Run' },
            type: { type: 'string', enum: ['boolean', 'count'], example: 'boolean' },
            unit: { type: 'string', example: 'km' },
            target: { type: 'number', minimum: 1, example: 1 },
            color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', example: '#6366f1' },
            icon: { type: 'string', example: '🎯' },
            frequency: {
              type: 'array',
              items: { type: 'integer', minimum: 0, maximum: 6 },
              example: [0, 1, 2, 3, 4, 5, 6],
            },
            category: {
              type: 'string',
              enum: ['health', 'fitness', 'learning', 'work', 'mindfulness', 'social', 'finance', 'other'],
              example: 'fitness',
            },
            isArchived: { type: 'boolean', example: false },
            currentStreak: { type: 'number', example: 5 },
            longestStreak: { type: 'number', example: 14 },
            sortOrder: { type: 'number', example: 0 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        HabitLog: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            habitId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            userId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            date: { type: 'string', format: 'date-time' },
            value: { oneOf: [{ type: 'boolean' }, { type: 'number' }], example: true },
            notes: { type: 'string', example: 'Felt great today!' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        SharedHabit: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            habitId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            ownerId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            sharedWith: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'string', example: '507f1f77bcf86cd799439011' },
                  role: { type: 'string', enum: ['admin', 'member', 'viewer'], example: 'member' },
                  joinedAt: { type: 'string', format: 'date-time' },
                  invitedBy: { type: 'string', example: '507f1f77bcf86cd799439011' },
                  status: { type: 'string', enum: ['pending', 'accepted', 'declined'], example: 'accepted' },
                },
              },
            },
            inviteCode: { type: 'string', example: 'abc123' },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Feedback: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            userId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            mood: { type: 'string', enum: ['loved', 'happy', 'neutral', 'confused', 'sad'], example: 'happy' },
            message: { type: 'string', example: 'Great app!' },
            page: { type: 'string', example: '/dashboard' },
            status: { type: 'string', enum: ['open', 'reviewed', 'resolved'], example: 'open' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PushSubscription: {
          type: 'object',
          properties: {
            endpoint: { type: 'string', example: 'https://fcm.googleapis.com/fcm/send/...' },
            keys: {
              type: 'object',
              properties: {
                p256dh: { type: 'string' },
                auth: { type: 'string' },
              },
              required: ['p256dh', 'auth'],
            },
          },
          required: ['endpoint', 'keys'],
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

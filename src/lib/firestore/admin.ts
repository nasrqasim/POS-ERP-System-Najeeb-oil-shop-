import * as admin from 'firebase-admin';

const privateKey = (process.env.FIREBASE_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDvsOc/k0IS0i9/\nWrKu1JCCSfJ5tRbldcXZgDJ+rI+sPkPCb0BjtWppDobQ0CVvLLyzaziF0fTS0uig\nL96zEeBAHAGJ+G+B2jxq7Y4YJrC1PhvOn4djMQ9lVpkQqz5j5WVN9j6bEKvkEI4E\ntJYvskX5EOhlTPlcInlm8QbnSN0Ha09JgewVtkgHDeTRfewRW+0yuQB7HMYJJUvD\ntRLWfEefOGVITIYG7D5HWzqf0M3QhpdLfISw+YI1rNDcDuCyUiBXGwS0WW7k7Y+c\ngzDLXV57EznL1EQ6L5p/nSNRuCnEjOh+IRb5NRSCx9Otnx6/C00Mf1th0xWe+qWg\nf2pt0OuZAgMBAAECggEAKW8aOoo5NMmyvkAufTxvkqY3zUQ5pgba4cNgdzdbSrok\nunrC1bmpoGmLcpNYtUQ1hop1ZeSqfrtIzVAZHjlr24k71t7kX70bDpzsIE6n41zO\nL8SyAbqcX7c9lH0Vtu0TuwtjPSj/ndgixLt27t3RbMG4erJ4tK2c8OefeuHEm6Bi\nmSAFXO3LfBiDAT9LyM9jbuKeobhU9FYTFqtr4+7rz2jOYwKoK/EhaAHascMa4qdh\nFKhmQn4L3GnZ0yjrhK+E7MtZ1D9xf/ikfBGgPfGCJFCmkYMknqz2VhUb1sv6YLiW\neR24rGUeIbVTW8zqaLCzVo3wGM6nLTzQygFGRIFDZQKBgQD69y3+YhaHfSe2Cfta\nkjghKsi3G+vcd8MO8Q8yQRpIp0upr5VDwTe8V6hfacF4zbYk9EKJV1Qo7MQ8Fycb\nr/spe29f06/HW9MQgvyUYNTbjRDrLvmq6UGZmEUmm87EuJ2aKXo/dH+zKZ9+q0Hh\ni3WXfyy5BdAr0D5IkDQQfp5cgwKBgQD0f9LvPUfXRgpyzScHFqAYzxs1gGL+kWIR\n3zkPiCUxji4WauNugOEmr+ES2nTpufqBY7Bp9t43lRyYABHaKzGqZ+C7jSN1ET8X\n1qi/c3bzpZ0CBzlSbw+PQ1NVfvAIxI1SUH1QRgHEte4TaFw9dX9Wb5/Pd/JfbUDH\n1oM/8/QUswKBgG6ZlElxTOB1BZUyHPWzTs0/H6miwnUsymfBUKMjEcRHBg9H9A4i\nDsAQGYHDB6KHdegfRVtlgw9uGKUqxu9qxNNpNJIUpnjDPOcf8tQpQGVpa7VZxGnP\n1jssYf072QnVGo+gC+H/I2//veyC6MvPPAmB4GHB8BX+9hPgiTFju8KlAoGANgzr\n/Kd3ckexl59yuUZvLgza3wD64XwSShEm9CAM2N+toJcQoCUtoPfQsfJJVkIe9uuq\n3EIO7gqwv4mEaM6TtDAypkOVSxP89rAlre1Apqw+AWzHZ0nWDr27dnMRbV7GPyQ8\nD7rqOSpe7ztq6MtI0zrqAVtq4V2trH/nlAPCObECgYEAu9H8mf5ONQv/oIwb2J7B\nOkMMtikSXQkMsFRF22fR+q1lW2/Tjtm5xC6l+hTfmXrbZuPxm7VasBrOJuTcqgL+\nx5kAg87EbYpbdqXFQaOAh/lCZcfcPFGS1EPplHP2E1zGQ5WEtgl4261K8ORUL8sp\nU2ESdrPlOStGTRi4HRNuA0g=\n-----END PRIVATE KEY-----\n`).replace(/\\n/g, '\n');

const serviceAccount: admin.ServiceAccount = {
  projectId: "al-hadeed-traders",
  clientEmail: "firebase-adminsdk-fbsvc@al-hadeed-traders.iam.gserviceaccount.com",
  privateKey,
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export const adminDb = admin.firestore();
adminDb.settings({ ignoreUndefinedProperties: true });

import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database (basic)...');

  // 1. Crear permisos base
  const permissions = await Promise.all([
    // Productos
    prisma.permission.upsert({
      where: { resource_action: { resource: 'products', action: 'create' } },
      update: {},
      create: { resource: 'products', action: 'create', description: 'Crear productos' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'products', action: 'read' } },
      update: {},
      create: { resource: 'products', action: 'read', description: 'Ver productos' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'products', action: 'update' } },
      update: {},
      create: { resource: 'products', action: 'update', description: 'Editar productos' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'products', action: 'delete' } },
      update: {},
      create: { resource: 'products', action: 'delete', description: 'Eliminar productos' },
    }),
    // Ventas
    prisma.permission.upsert({
      where: { resource_action: { resource: 'sales', action: 'create' } },
      update: {},
      create: { resource: 'sales', action: 'create', description: 'Crear ventas' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'sales', action: 'read' } },
      update: {},
      create: { resource: 'sales', action: 'read', description: 'Ver ventas' },
    }),
    // Inventario
    prisma.permission.upsert({
      where: { resource_action: { resource: 'inventory', action: 'read' } },
      update: {},
      create: { resource: 'inventory', action: 'read', description: 'Ver inventario' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'inventory', action: 'adjust' } },
      update: {},
      create: { resource: 'inventory', action: 'adjust', description: 'Ajustar inventario' },
    }),
    // Reportes
    prisma.permission.upsert({
      where: { resource_action: { resource: 'reports', action: 'read' } },
      update: {},
      create: { resource: 'reports', action: 'read', description: 'Ver reportes' },
    }),
    // Configuración
    prisma.permission.upsert({
      where: { resource_action: { resource: 'settings', action: 'update' } },
      update: {},
      create: { resource: 'settings', action: 'update', description: 'Modificar configuración' },
    }),
    // Clientes
    prisma.permission.upsert({
      where: { resource_action: { resource: 'customers', action: 'read' } },
      update: {},
      create: { resource: 'customers', action: 'read', description: 'Ver clientes' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'customers', action: 'create' } },
      update: {},
      create: { resource: 'customers', action: 'create', description: 'Crear clientes' },
    }),
    // Caja
    prisma.permission.upsert({
      where: { resource_action: { resource: 'cash_register', action: 'read' } },
      update: {},
      create: { resource: 'cash_register', action: 'read', description: 'Ver estado de caja' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'cash_register', action: 'open' } },
      update: {},
      create: { resource: 'cash_register', action: 'open', description: 'Abrir caja' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'cash_register', action: 'close' } },
      update: {},
      create: { resource: 'cash_register', action: 'close', description: 'Cerrar caja' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'cash_register', action: 'manage' } },
      update: {},
      create: { resource: 'cash_register', action: 'manage', description: 'Gestionar movimientos de caja' },
    }),
    // Roles
    prisma.permission.upsert({
      where: { resource_action: { resource: 'roles', action: 'create' } },
      update: {},
      create: { resource: 'roles', action: 'create', description: 'Crear roles' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'roles', action: 'read' } },
      update: {},
      create: { resource: 'roles', action: 'read', description: 'Ver roles' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'roles', action: 'update' } },
      update: {},
      create: { resource: 'roles', action: 'update', description: 'Editar roles' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'roles', action: 'delete' } },
      update: {},
      create: { resource: 'roles', action: 'delete', description: 'Eliminar roles' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'roles', action: 'manage' } },
      update: {},
      create: { resource: 'roles', action: 'manage', description: 'Gestionar roles y permisos' },
    }),
    // Usuarios
    prisma.permission.upsert({
      where: { resource_action: { resource: 'users', action: 'create' } },
      update: {},
      create: { resource: 'users', action: 'create', description: 'Crear usuarios' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'users', action: 'read' } },
      update: {},
      create: { resource: 'users', action: 'read', description: 'Ver usuarios' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'users', action: 'update' } },
      update: {},
      create: { resource: 'users', action: 'update', description: 'Editar usuarios' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'users', action: 'delete' } },
      update: {},
      create: { resource: 'users', action: 'delete', description: 'Eliminar usuarios' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'users', action: 'manage' } },
      update: {},
      create: { resource: 'users', action: 'manage', description: 'Gestionar usuarios y roles' },
    }),
  ]);

  console.log(`✅ Created ${permissions.length} permissions`);

  const permissionMap = permissions.reduce<Record<string, string>>((acc, permission) => {
    acc[`${permission.resource}:${permission.action}`] = permission.id;
    return acc;
  }, {});

  // 2. Crear negocio de ejemplo
  const business = await prisma.business.upsert({
    where: { cuit: '20-12345678-9' },
    update: {},
    create: {
      name: 'Ferretería Demo',
      cuit: '20-12345678-9',
      address: 'Av. Ejemplo 123, CABA',
      phone: '+54 11 1234-5678',
      email: 'info@ferreteria-demo.com',
      taxCondition: 'RESPONSABLE_INSCRIPTO',
      invoiceProvider: 'mock',
      allowNegativeStock: false,
    },
  });

  console.log(`✅ Created business: ${business.name}`);

  // 3. Crear roles base
  const ownerRole = await prisma.role.upsert({
    where: { businessId_name: { businessId: business.id, name: 'OWNER' } },
    update: {},
    create: {
      businessId: business.id,
      name: 'OWNER',
      description: 'Dueño del negocio - acceso total',
      isSystem: true,
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { businessId_name: { businessId: business.id, name: 'ADMIN' } },
    update: {},
    create: {
      businessId: business.id,
      name: 'ADMIN',
      description: 'Administrador - acceso casi total',
      isSystem: true,
    },
  });

  const cashierRole = await prisma.role.upsert({
    where: { businessId_name: { businessId: business.id, name: 'CASHIER' } },
    update: {},
    create: {
      businessId: business.id,
      name: 'CASHIER',
      description: 'Cajero - ventas y caja',
      isSystem: true,
    },
  });

  console.log('✅ Created roles: OWNER, ADMIN, CASHIER');

  // 4. Asignar todos los permisos al OWNER
  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({
      roleId: ownerRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  const adminPermissionKeys = [
    'products:read',
    'products:update',
    'sales:create',
    'sales:read',
    'inventory:read',
    'inventory:adjust',
    'reports:read',
    'settings:update',
    'cash_register:read',
    'cash_register:open',
    'cash_register:close',
    'cash_register:manage',
    'customers:read',
    'customers:create',
  ];

  await prisma.rolePermission.createMany({
    data: adminPermissionKeys
      .map((key) => permissionMap[key])
      .filter(Boolean)
      .map((permissionId) => ({
        roleId: adminRole.id,
        permissionId: permissionId!,
      })),
    skipDuplicates: true,
  });

  const cashierPermissionKeys = [
    'products:read',
    'sales:create',
    'sales:read',
    'inventory:read',
    'cash_register:read',
    'cash_register:open',
    'cash_register:close',
    'cash_register:manage',
  ];

  await prisma.rolePermission.createMany({
    data: cashierPermissionKeys
      .map((key) => permissionMap[key])
      .filter(Boolean)
      .map((permissionId) => ({
        roleId: cashierRole.id,
        permissionId: permissionId!,
      })),
    skipDuplicates: true,
  });

  // 5. Crear usuario admin
  const hashedPassword = await hash('Admin123456');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ferreteria-demo.com' },
    update: {},
    create: {
      businessId: business.id,
      email: 'admin@ferreteria-demo.com',
      username: 'admin',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Demo',
      isActive: true,
    },
  });

  // Asignar rol OWNER
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: ownerRole.id } },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: ownerRole.id,
    },
  });

  console.log(`✅ Created admin user: ${adminUser.email} / Admin123456`);

  // 6. Crear categorías básicas
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { businessId_name: { businessId: business.id, name: 'Herramientas' } },
      update: {},
      create: { businessId: business.id, name: 'Herramientas' },
    }),
    prisma.category.upsert({
      where: { businessId_name: { businessId: business.id, name: 'Pinturas' } },
      update: {},
      create: { businessId: business.id, name: 'Pinturas' },
    }),
    prisma.category.upsert({
      where: { businessId_name: { businessId: business.id, name: 'Electricidad' } },
      update: {},
      create: { businessId: business.id, name: 'Electricidad' },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // 7. Crear productos básicos (idempotente)
  const baseProducts = [
    {
      internalSku: 'FER-00001',
      name: 'Martillo',
      categoryId: categories[0].id,
      unit: 'u',
      cost: 5000,
      price: 8000,
      taxRate: 21,
      stockQuantity: 10,
      minStock: 5,
    },
    {
      internalSku: 'FER-00002',
      name: 'Pintura Blanca 1L',
      categoryId: categories[1].id,
      unit: 'u',
      cost: 3000,
      price: 5000,
      taxRate: 21,
      stockQuantity: 20,
      minStock: 10,
    },
    {
      internalSku: 'FER-00003',
      barcode: '7798123456789',
      name: 'Cable 2.5mm (metro)',
      categoryId: categories[2].id,
      unit: 'mt',
      isFractional: true,
      cost: 500,
      price: 800,
      taxRate: 21,
      stockQuantity: 100,
      minStock: 50,
    },
  ];

  const products = await Promise.all(
    baseProducts.map((product) =>
      prisma.product.upsert({
        where: { internalSku: product.internalSku },
        update: {},
        create: {
          businessId: business.id,
          ...product,
        },
      })
    )
  );

  console.log(`✅ Created ${products.length} products`);

  console.log('\n✨ Basic seed completed successfully!');
  console.log('\n📝 Login credentials:');
  console.log('   Email: admin@ferreteria-demo.com');
  console.log('   Password: Admin123456');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

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
    prisma.permission.upsert({
      where: { resource_action: { resource: 'products', action: 'manage' } },
      update: {},
      create: { resource: 'products', action: 'manage', description: 'Gestionar productos' },
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
    prisma.permission.upsert({
      where: { resource_action: { resource: 'sales', action: 'approve_discount' } },
      update: {},
      create: { resource: 'sales', action: 'approve_discount', description: 'Aprobar descuentos' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'sales', action: 'refund' } },
      update: {},
      create: { resource: 'sales', action: 'refund', description: 'Reembolsar ventas' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'sales', action: 'manage' } },
      update: {},
      create: { resource: 'sales', action: 'manage', description: 'Gestionar ventas y descuentos' },
    }),
    // Compras
    prisma.permission.upsert({
      where: { resource_action: { resource: 'purchases', action: 'create' } },
      update: {},
      create: { resource: 'purchases', action: 'create', description: 'Crear compras' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'purchases', action: 'read' } },
      update: {},
      create: { resource: 'purchases', action: 'read', description: 'Ver compras' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'purchases', action: 'update' } },
      update: {},
      create: { resource: 'purchases', action: 'update', description: 'Editar compras y proveedores' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'purchases', action: 'delete' } },
      update: {},
      create: { resource: 'purchases', action: 'delete', description: 'Eliminar compras y proveedores' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'purchases', action: 'manage' } },
      update: {},
      create: { resource: 'purchases', action: 'manage', description: 'Gestionar compras' },
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
    prisma.permission.upsert({
      where: { resource_action: { resource: 'inventory', action: 'manage' } },
      update: {},
      create: { resource: 'inventory', action: 'manage', description: 'Gestionar inventario' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'inventory', action: 'return' } },
      update: {},
      create: { resource: 'inventory', action: 'return', description: 'Procesar devoluciones de clientes' },
    }),
    // Reportes
    prisma.permission.upsert({
      where: { resource_action: { resource: 'reports', action: 'read' } },
      update: {},
      create: { resource: 'reports', action: 'read', description: 'Ver reportes' },
    }),
    // Configuración
    prisma.permission.upsert({
      where: { resource_action: { resource: 'settings', action: 'read' } },
      update: {},
      create: { resource: 'settings', action: 'read', description: 'Ver configuración' },
    }),
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
    prisma.permission.upsert({
      where: { resource_action: { resource: 'customers', action: 'update' } },
      update: {},
      create: { resource: 'customers', action: 'update', description: 'Editar clientes' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'customers', action: 'delete' } },
      update: {},
      create: { resource: 'customers', action: 'delete', description: 'Eliminar clientes' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'customers', action: 'manage' } },
      update: {},
      create: { resource: 'customers', action: 'manage', description: 'Gestionar clientes' },
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
    // Cuentas Financieras
    prisma.permission.upsert({
      where: { resource_action: { resource: 'financial_accounts', action: 'create' } },
      update: {},
      create: { resource: 'financial_accounts', action: 'create', description: 'Crear cuentas financieras' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'financial_accounts', action: 'read' } },
      update: {},
      create: { resource: 'financial_accounts', action: 'read', description: 'Ver cuentas financieras' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'financial_accounts', action: 'update' } },
      update: {},
      create: { resource: 'financial_accounts', action: 'update', description: 'Editar cuentas financieras' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'financial_accounts', action: 'delete' } },
      update: {},
      create: { resource: 'financial_accounts', action: 'delete', description: 'Eliminar cuentas financieras' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'financial_accounts', action: 'manage' } },
      update: {},
      create: { resource: 'financial_accounts', action: 'manage', description: 'Gestionar cuentas financieras' },
    }),
    // Cheques
    prisma.permission.upsert({
      where: { resource_action: { resource: 'checks', action: 'read' } },
      update: {},
      create: { resource: 'checks', action: 'read', description: 'Ver cheques emitidos' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'checks', action: 'manage' } },
      update: {},
      create: { resource: 'checks', action: 'manage', description: 'Emitir y gestionar cheques' },
    }),
    // Movimientos Financieros
    prisma.permission.upsert({
      where: { resource_action: { resource: 'financial_movements', action: 'create' } },
      update: {},
      create: { resource: 'financial_movements', action: 'create', description: 'Crear movimientos y transferencias' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'financial_movements', action: 'read' } },
      update: {},
      create: { resource: 'financial_movements', action: 'read', description: 'Ver movimientos financieros' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'financial_movements', action: 'manage' } },
      update: {},
      create: { resource: 'financial_movements', action: 'manage', description: 'Gestionar movimientos financieros' },
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
    // Pricing (Gestión de precios)
    prisma.permission.upsert({
      where: { resource_action: { resource: 'pricing', action: 'approve' } },
      update: {},
      create: { resource: 'pricing', action: 'approve', description: 'Aprobar cambios de precio sugeridos' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'pricing', action: 'view_suggestions' } },
      update: {},
      create: { resource: 'pricing', action: 'view_suggestions', description: 'Ver sugerencias de precio pendientes' },
    }),
    // Brands (Marcas)
    prisma.permission.upsert({
      where: { resource_action: { resource: 'brands', action: 'create' } },
      update: {},
      create: { resource: 'brands', action: 'create', description: 'Crear marcas' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'brands', action: 'read' } },
      update: {},
      create: { resource: 'brands', action: 'read', description: 'Ver marcas' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'brands', action: 'update' } },
      update: {},
      create: { resource: 'brands', action: 'update', description: 'Editar marcas' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'brands', action: 'delete' } },
      update: {},
      create: { resource: 'brands', action: 'delete', description: 'Eliminar marcas' },
    }),
    // Categories (Categorías)
    prisma.permission.upsert({
      where: { resource_action: { resource: 'categories', action: 'create' } },
      update: {},
      create: { resource: 'categories', action: 'create', description: 'Crear categorías' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'categories', action: 'read' } },
      update: {},
      create: { resource: 'categories', action: 'read', description: 'Ver categorías' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'categories', action: 'update' } },
      update: {},
      create: { resource: 'categories', action: 'update', description: 'Editar categorías' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'categories', action: 'delete' } },
      update: {},
      create: { resource: 'categories', action: 'delete', description: 'Eliminar categorías' },
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

  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({
      roleId: adminRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  const cashierPermissionKeys = [
    'products:read',
    'sales:create',
    'sales:read',
    'sales:refund',
    'inventory:read',
    'inventory:return',
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

  // 5. Crear usuario admin (usuario de prueba con todos los permisos)
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

  // Asignar rol OWNER (que tiene todos los permisos)
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: ownerRole.id } },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: ownerRole.id,
    },
  });

  console.log(`✅ Created admin user: ${adminUser.email} / Admin123456`);
  console.log(`✅ Assigned OWNER role with all ${permissions.length} permissions to admin user`);

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
      marginPercent: 37.5,
      stockQuantity: 3,
      minStock: 5,
      pricingMode: 'margin',
      targetMargin: 37.5,
      priceLocked: false,
      roundingStep: 10,
      costMethod: 'avg_weighted',
    },
    {
      internalSku: 'FER-00002',
      name: 'Pintura Blanca 1L',
      categoryId: categories[1].id,
      unit: 'u',
      cost: 3000,
      price: 5000,
      taxRate: 21,
      marginPercent: 40,
      stockQuantity: 8,
      minStock: 10,
      pricingMode: 'margin',
      targetMargin: 40,
      priceLocked: false,
      roundingStep: 10,
      costMethod: 'avg_weighted',
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
      marginPercent: 37.5,
      stockQuantity: 100,
      minStock: 50,
      pricingMode: 'margin',
      targetMargin: 37.5,
      priceLocked: false,
      roundingStep: 10,
      costMethod: 'avg_weighted',
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

  // 9. Crear cuentas financieras por defecto
  const financialAccounts = await Promise.all([
    prisma.financialAccount.upsert({
      where: { businessId_name: { businessId: business.id, name: 'Caja Principal' } },
      update: {},
      create: {
        businessId: business.id,
        type: 'CASH',
        name: 'Caja Principal',
        description: 'Caja física para efectivo',
        currency: 'ARS',
        balance: 0,
        isDefault: true,
        isActive: true,
      },
    }),
    prisma.financialAccount.upsert({
      where: { businessId_name: { businessId: business.id, name: 'Cuenta Bancaria' } },
      update: {},
      create: {
        businessId: business.id,
        type: 'BANK',
        name: 'Cuenta Bancaria',
        description: 'Cuenta bancaria principal',
        currency: 'ARS',
        balance: 100000, // Balance inicial de ejemplo
        isDefault: true,
        isActive: true,
        bankName: 'Banco Ejemplo',
        accountNumber: '1234567890',
      },
    }),
    prisma.financialAccount.upsert({
      where: { businessId_name: { businessId: business.id, name: 'MercadoPago' } },
      update: {},
      create: {
        businessId: business.id,
        type: 'WALLET',
        name: 'MercadoPago',
        description: 'Billetera virtual MercadoPago',
        currency: 'ARS',
        balance: 0,
        isDefault: true,
        isActive: true,
        walletProvider: 'mercadopago',
      },
    }),
  ]);

  console.log(`✅ Created ${financialAccounts.length} financial accounts`);

  console.log('\n✨ Basic seed completed successfully!');
  console.log('\n📝 Login credentials:');
  console.log('   Email: admin@ferreteria-demo.com');
  console.log('   Password: Admin123456');
  console.log('\n💰 Financial Accounts:');
  console.log('   - Caja Principal (CASH): $0.00');
  console.log('   - Cuenta Bancaria (BANK): $100,000.00');
  console.log('   - MercadoPago (WALLET): $0.00');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

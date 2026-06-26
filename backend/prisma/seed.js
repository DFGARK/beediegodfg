const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.upsert({
    where: { code: 'beehive' },
    update: {},
    create: {
      name: 'Beehive International School',
      code: 'beehive',
      address: 'Quetzaltenango, Guatemala',
      phone: '+502 7761-0000',
      email: 'info@beehive.edu.gt',
      primaryColor: '#F5C400',
    },
  });
  console.log('Colegio creado:', school.name);

  const passwordHash = await bcrypt.hash('Admin2026!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@beehive.edu.gt' },
    update: {},
    create: {
      email: 'admin@beehive.edu.gt',
      passwordHash,
      firstName: 'Administrador',
      lastName: '',
      role: 'ADMIN',
      schoolId: school.id,
    },
  });
  console.log('Admin creado:', admin.email);

  const gradeNames = ['7mo', '8vo', '9no', '10mo', '11mo'];
  const sections = ['HS', 'BYS'];
  for (const name of gradeNames) {
    for (const section of sections) {
      await prisma.grade.upsert({
        where: { name_section_year_schoolId: { name, section, year: 2026, schoolId: school.id } },
        update: {},
        create: { name, section, year: 2026, schoolId: school.id },
      });
    }
  }
  console.log('Grados creados: 10 (5 HS + 5 BYS)');

  await prisma.reader.upsert({
    where: { id: 'reader-entrada-principal' },
    update: {},
    create: {
      id: 'reader-entrada-principal',
      name: 'Entrada Principal',
      location: 'Puerta principal del colegio',
      schoolId: school.id,
    },
  });

  await prisma.reader.upsert({
    where: { id: 'reader-entrada-secundaria' },
    update: {},
    create: {
      id: 'reader-entrada-secundaria',
      name: 'Entrada Secundaria',
      location: 'Puerta lateral patio',
      schoolId: school.id,
    },
  });
  console.log('Lectores creados: 2');

  console.log('\nSeed completado!');
  console.log('Login: admin@beehive.edu.gt / Admin2026!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

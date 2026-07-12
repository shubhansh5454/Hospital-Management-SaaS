import { Router } from 'express';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';
import { prisma } from '../../db/prisma.ts';
import { AuthRequest } from '../../middleware/auth.ts';

const router = Router();

// GET /api/settings - Fetch settings for user's clinic
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ error: 'No clinic context found for your user.' });
    }

    // Try to find setting
    let settings = await prisma.clinicSetting.findUnique({
      where: { clinicId }
    });

    // If not found, seed standard default settings
    if (!settings) {
      const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId }
      });
      if (!clinic) {
        return res.status(404).json({ error: 'Clinic not found.' });
      }

      const defaultWorkingHours = {
        Monday: { enabled: true, start: '09:00', end: '17:00' },
        Tuesday: { enabled: true, start: '09:00', end: '17:00' },
        Wednesday: { enabled: true, start: '09:00', end: '17:00' },
        Thursday: { enabled: true, start: '09:00', end: '17:00' },
        Friday: { enabled: true, start: '09:00', end: '17:00' },
        Saturday: { enabled: false, start: '10:00', end: '14:00' },
        Sunday: { enabled: false, start: '10:00', end: '14:00' }
      };

      const defaultHolidays = [
        { date: '2026-12-25', name: 'Christmas Day' },
        { date: '2026-01-01', name: 'New Year Day' }
      ];

      settings = await prisma.clinicSetting.create({
        data: {
          clinicId,
          hospitalName: clinic.name,
          hospitalCode: clinic.slug.toUpperCase(),
          address: clinic.address || '',
          contactNumber: clinic.phone || '',
          website: '',
          departments: JSON.stringify(['General Medicine', 'Cardiology', 'Pediatrics', 'Dermatology', 'Neurology']),
          consultationFees: 50.0,
          slotDuration: 15,
          maxSlotsPerDay: 30,
          workingHours: JSON.stringify(defaultWorkingHours),
          holidays: JSON.stringify(defaultHolidays),
          taxRate: 10.0,
          taxName: 'GST',
          currency: 'USD',
          language: 'en',
          emailHost: 'smtp.mailtrap.io',
          emailPort: 2525,
          emailUser: 'smtp_user_demo',
          emailPassword: 'smtp_password_demo',
          emailFrom: 'noreply@clinic.com',
          emailEnabled: false,
          smsGateway: 'twilio',
          smsSid: 'AC_demo_sid',
          smsToken: 'token_demo',
          smsFrom: '+15551234',
          smsEnabled: false,
          waGateway: 'whatsapp',
          waToken: 'wa_token_demo',
          waNumber: '+15551234',
          waEnabled: false
        }
      });
    }

    return res.status(200).json(settings);
  } catch (err: any) {
    console.error('Error in GET /api/settings:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch settings' });
  }
});

// PUT /api/settings - Update settings for user's clinic (Only accessible by admin or superadmin)
router.put('/', requireAuth, requireRoles(['admin', 'superadmin']), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ error: 'No clinic context found for your user.' });
    }

    const {
      hospitalName,
      hospitalCode,
      address,
      contactNumber,
      website,
      departments,
      consultationFees,
      slotDuration,
      maxSlotsPerDay,
      workingHours,
      holidays,
      taxRate,
      taxName,
      currency,
      language,
      emailHost,
      emailPort,
      emailUser,
      emailPassword,
      emailFrom,
      emailEnabled,
      smsGateway,
      smsSid,
      smsToken,
      smsFrom,
      smsEnabled,
      waGateway,
      waToken,
      waNumber,
      waEnabled
    } = req.body;

    // Validate and upsert
    const updated = await prisma.clinicSetting.upsert({
      where: { clinicId },
      update: {
        hospitalName,
        hospitalCode,
        address,
        contactNumber,
        website,
        departments: typeof departments === 'string' ? departments : JSON.stringify(departments || []),
        consultationFees: consultationFees !== undefined ? parseFloat(consultationFees) : undefined,
        slotDuration: slotDuration !== undefined ? parseInt(slotDuration) : undefined,
        maxSlotsPerDay: maxSlotsPerDay !== undefined ? parseInt(maxSlotsPerDay) : undefined,
        workingHours: typeof workingHours === 'string' ? workingHours : JSON.stringify(workingHours || {}),
        holidays: typeof holidays === 'string' ? holidays : JSON.stringify(holidays || []),
        taxRate: taxRate !== undefined ? parseFloat(taxRate) : undefined,
        taxName,
        currency,
        language,
        emailHost,
        emailPort: emailPort !== undefined ? (emailPort === '' ? null : parseInt(emailPort)) : undefined,
        emailUser,
        emailPassword,
        emailFrom,
        emailEnabled: emailEnabled !== undefined ? Boolean(emailEnabled) : undefined,
        smsGateway,
        smsSid,
        smsToken,
        smsFrom,
        smsEnabled: smsEnabled !== undefined ? Boolean(smsEnabled) : undefined,
        waGateway,
        waToken,
        waNumber,
        waEnabled: waEnabled !== undefined ? Boolean(waEnabled) : undefined
      },
      create: {
        clinicId,
        hospitalName: hospitalName || '',
        hospitalCode: hospitalCode || '',
        address: address || '',
        contactNumber: contactNumber || '',
        website: website || '',
        departments: typeof departments === 'string' ? departments : JSON.stringify(departments || []),
        consultationFees: consultationFees !== undefined ? parseFloat(consultationFees) : 50.0,
        slotDuration: slotDuration !== undefined ? parseInt(slotDuration) : 15,
        maxSlotsPerDay: maxSlotsPerDay !== undefined ? parseInt(maxSlotsPerDay) : 30,
        workingHours: typeof workingHours === 'string' ? workingHours : JSON.stringify(workingHours || {}),
        holidays: typeof holidays === 'string' ? holidays : JSON.stringify(holidays || []),
        taxRate: taxRate !== undefined ? parseFloat(taxRate) : 0.0,
        taxName: taxName || 'GST',
        currency: currency || 'USD',
        language: language || 'en',
        emailHost: emailHost || '',
        emailPort: emailPort !== undefined && emailPort !== '' ? parseInt(emailPort) : null,
        emailUser: emailUser || '',
        emailPassword: emailPassword || '',
        emailFrom: emailFrom || '',
        emailEnabled: emailEnabled !== undefined ? Boolean(emailEnabled) : false,
        smsGateway: smsGateway || '',
        smsSid: smsSid || '',
        smsToken: smsToken || '',
        smsFrom: smsFrom || '',
        smsEnabled: smsEnabled !== undefined ? Boolean(smsEnabled) : false,
        waGateway: waGateway || '',
        waToken: waToken || '',
        waNumber: waNumber || '',
        waEnabled: waEnabled !== undefined ? Boolean(waEnabled) : false
      }
    });

    return res.status(200).json(updated);
  } catch (err: any) {
    console.error('Error in PUT /api/settings:', err);
    return res.status(500).json({ error: err.message || 'Failed to update settings' });
  }
});

export const settingsRouter = router;

import axios from 'axios';
import qs from 'querystring';
import { publishDashboardUpdate, triggerDashboardUpdate } from '../services/dashboard-update';

const NOCODB_BASE = process.env.IWKZ_NOCODB_API || '';
const NOCODB_TOKEN = process.env.IWKZ_NOCODB_API_TOKEN || '';
const NOCODB_TABLE = process.env.IWKZ_NOCODB_TABLE_DONATIONPACKAGE || '';
const VERIFY_IPN =
  `${process.env.PAYPAL_WEBHOOK_VERIFICATION ?? 'true'}`.toLowerCase() ===
  'true';

const noco = axios.create({
  baseURL: NOCODB_BASE,
  timeout: 8000,
  headers: {
    'xc-token': NOCODB_TOKEN,
    'Content-Type': 'application/json',
  },
});

const paypalVerifyUrl = () => {
  const base = process.env.PAYPAL_BASE_URL || '';
  return base.includes('sandbox')
    ? 'https://www.sandbox.paypal.com/cgi-bin/webscr?cmd=_notify-validate'
    : 'https://www.paypal.com/cgi-bin/webscr?cmd=_notify-validate';
};

const getRawBody = (ctx): string => {
  const unparsed = (ctx.request as any).body?.[Symbol.for('unparsedBody')];
  if (unparsed) {
    if (Buffer.isBuffer(unparsed)) return unparsed.toString('utf8');
    return unparsed.toString();
  }

  const raw = (ctx.request as any).rawBody;
  if (raw) return raw.toString();

  return qs.stringify(ctx.request.body || {});
};

const verifyIpn = async (rawBody: string) => {
  if (!VERIFY_IPN) return true;
  try {
    const res = await axios.post(paypalVerifyUrl(), rawBody, {
      timeout: 8000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return res.data === 'VERIFIED';
  } catch (err) {
    strapi.log.error(
      '[paypal-webhook] IPN verify error',
      err?.response?.data || err.message
    );
    return false;
  }
};

const findExisting = async (captureId: string) => {
  const where = encodeURIComponent(`(capture_id,eq,${captureId})`);
  const res = await noco.get(
    `/tables/${NOCODB_TABLE}/records?where=${where}&limit=1`
  );
  return res.data?.list?.[0] || null;
};

const createRecord = async (payload: Record<string, unknown>) => {
  return noco.post(`/tables/${NOCODB_TABLE}/records`, payload);
};

const updateIsCompleted = async (row: any) => {
  const { created_at, updated_at, ...rest } = row;
  return noco.patch(`/tables/${NOCODB_TABLE}/records/`, {
    ...rest,
    is_completed: 1,
  });
};

export default {
  async publishDashboardUpdate(ctx) {
    await publishDashboardUpdate(strapi);

    ctx.status = 200;
    ctx.body = {
      status: 'ok',
      action: 'dashboard_update_triggered',
    };
    return;
  },
  async paypal(ctx) {
    const rawBody = getRawBody(ctx);
    const body = ctx.request.body || {};

    // Skip empty payloads to avoid unnecessary verification calls
    if (!body || Object.keys(body).length === 0) {
      strapi.log.warn('[paypal-webhook] Empty payload, ignored');
      ctx.status = 200;
      ctx.body = { status: 'ignored' };
      return;
    }

    const isValid = await verifyIpn(rawBody);
    if (!isValid) {
      strapi.log.warn('[paypal-webhook] INVALID IPN');
      ctx.status = 200;
      ctx.body = { status: 'ignored' };
      return;
    }

    const isOrderBased = Boolean(body.item_name1);
    const isManual = Boolean(body.memo);

    if (!isOrderBased && !isManual) {
      strapi.log.warn('[paypal-webhook] Unknown IPN shape', body);
      ctx.status = 200;
      ctx.body = { status: 'ignored' };
      return;
    }

    const txnId = body.txn_id;
    if (!txnId) {
      strapi.log.warn('[paypal-webhook] Missing txn_id', body);
      ctx.status = 200;
      ctx.body = { status: 'ignored' };
      return;
    }

    let captureId: string | undefined;
    let totalPrice = 0;
    let donationCode: string | undefined;
    const webhookCaptureId = `webhook-${txnId}`;

    if (isOrderBased) {
      captureId = body.custom || webhookCaptureId;
      totalPrice = parseFloat(body.mc_gross_1 || '0');
      donationCode = body.item_name1;
    } else {
      captureId = webhookCaptureId;
      const gross = parseFloat(body.mc_gross || '0');
      const fee = parseFloat(body.mc_fee || '0');
      totalPrice = gross - fee;
      donationCode = body.memo;
    }

    if (!captureId) {
      strapi.log.warn('[paypal-webhook] Missing capture_id', body);
      ctx.status = 200;
      ctx.body = { status: 'ignored' };
      return;
    }

    const payload = {
      capture_id: captureId,
      total_price: totalPrice,
      donation_code: donationCode,
      transaction_id: txnId,
      description: 'paypal-webhook',
      is_completed: 1,
    };

    try {
      const existing = await findExisting(captureId);

      if (existing) {
        if (Number(existing.is_completed) === 1) {
          ctx.status = 200;
          ctx.body = { status: 'ok', action: 'do_nothing' };
          return;
        }

        await updateIsCompleted(existing);

        //fire and forget, we don't want to block the webhook response
        triggerDashboardUpdate(strapi);

        ctx.status = 200;
        ctx.body = { status: 'ok', action: 'updated' };
        return;
      }

      await createRecord(payload);

      //fire and forget, we don't want to block the webhook response
      triggerDashboardUpdate(strapi);

      ctx.status = 200;
      ctx.body = { status: 'ok', action: 'created' };
    } catch (err) {
      const detail = err?.response?.data || err.message;

      // Handle potential duplicate key errors as benign idempotency hits
      if (
        err?.response?.status === 409 ||
        `${detail}`.toLowerCase().includes('duplicate')
      ) {
        strapi.log.warn(
          '[paypal-webhook] Duplicate capture_id treated as existing'
        );
        ctx.status = 200;
        ctx.body = { status: 'ok', action: 'duplicate' };
        return;
      }

      strapi.log.error('[paypal-webhook] NocoDB error', detail);
      ctx.status = 200;
      ctx.body = { status: 'error', detail };
    }
  },
};

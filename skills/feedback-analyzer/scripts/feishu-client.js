'use strict';

// 飞书开放平台 Bitable API 最小封装（自建应用 + tenant_access_token）。
// 依据官方文档：
// - 获取 tenant_access_token: POST /open-apis/auth/v3/tenant_access_token/internal
// - 列出记录: GET /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records
// - 更新记录: PUT /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records/:record_id
// Node 18+ 内置 fetch，无需额外依赖。

const BASE_URL = 'https://open.feishu.cn/open-apis';

let cachedToken = null;
let cachedExpireAt = 0;

async function getTenantAccessToken({ appId, appSecret }) {
  const now = Date.now();
  if (cachedToken && now < cachedExpireAt - 60_000) {
    return cachedToken;
  }
  const resp = await fetch(`${BASE_URL}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const json = await resp.json();
  if (json.code !== 0) {
    throw new Error(`获取 tenant_access_token 失败: [${json.code}] ${json.msg}`);
  }
  cachedToken = json.tenant_access_token;
  cachedExpireAt = now + json.expire * 1000;
  return cachedToken;
}

async function listAllRecords({ appId, appSecret, appToken, tableId, pageSize = 500 }) {
  const token = await getTenantAccessToken({ appId, appSecret });
  const records = [];
  let pageToken = '';
  do {
    const url = new URL(`${BASE_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records`);
    url.searchParams.set('page_size', String(pageSize));
    if (pageToken) url.searchParams.set('page_token', pageToken);
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await resp.json();
    if (json.code !== 0) {
      throw new Error(`列出记录失败: [${json.code}] ${json.msg}`);
    }
    records.push(...(json.data.items || []));
    pageToken = json.data.has_more ? json.data.page_token : '';
  } while (pageToken);
  return records;
}

async function updateRecordFields({ appId, appSecret, appToken, tableId, recordId, fields }) {
  const token = await getTenantAccessToken({ appId, appSecret });
  const resp = await fetch(
    `${BASE_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ fields }),
    }
  );
  const json = await resp.json();
  if (json.code !== 0) {
    throw new Error(`更新记录失败: [${json.code}] ${json.msg}`);
  }
  return json.data.record;
}

module.exports = { getTenantAccessToken, listAllRecords, updateRecordFields };

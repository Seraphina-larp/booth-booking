# LINE 場次申請部署設定

## 已設定的 LIFF

- LIFF ID：`2010754497-onVcfQzW`
- Endpoint：`https://booth-booking-nu.vercel.app/line-request`

## Vercel 環境變數

正式部署前，請在 Vercel 專案的 Settings → Environment Variables 新增下列變數。所有變數至少勾選 Production 與 Preview。

### LINE

- `LINE_LOGIN_CHANNEL_ID`：LINE Login Channel ID（本專案為 `2010754497`）
- `LINE_CHANNEL_ACCESS_TOKEN`：Messaging API Channel 的長效 Channel access token

### Firebase Admin

以下兩種設定方法擇一，建議使用方法 A。

方法 A：完整 JSON

- `FIREBASE_SERVICE_ACCOUNT`：Firebase 服務帳戶金鑰 JSON 的完整內容

方法 B：分開設定

- `FIREBASE_PROJECT_ID`：`booth-booking-31111`
- `FIREBASE_CLIENT_EMAIL`：服務帳戶 JSON 內的 `client_email`
- `FIREBASE_PRIVATE_KEY`：服務帳戶 JSON 內的 `private_key` 完整內容

上述 Token、服務帳戶 JSON、Email 與 Private Key 均不得放進 GitHub、前端程式碼、聊天訊息或公開截圖。

## 功能流程

1. 夥伴由 LIFF URL 在 LINE 內開啟申請頁。
2. LINE 驗證身分後，夥伴填寫日期、開始時間、使用時數、活動名稱。
3. 伺服器驗證 LINE ID token，再以 Firebase Admin 寫入 `applications`。
4. 管理者後台即時出現待確認數量。
5. 核准時必須選包廂並填入有效場地費，完成後傳送 LINE 核准通知。
6. 拒絕時選擇原因或自訂原因，完成後傳送 LINE 拒絕通知。

## 安全設計

- LIFF 送出的 LINE ID token 由伺服器向 LINE 驗證。
- LINE Channel access token 只存在 Vercel 伺服器環境。
- 核准與拒絕通知 API 會驗證 Firebase 登入者確實為 admin。
- Firestore 用戶端安全規則不必開放 LINE 申請的額外寫入權限。

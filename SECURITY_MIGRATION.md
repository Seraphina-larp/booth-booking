# Firestore 安全改版啟用步驟

> 請依順序操作。正式切換前不要刪除既有的 `appData`。

## 1. 建立管理員身分文件

1. Firebase Console → Authentication → Users，複製管理員帳號的 `User UID`。
2. Firestore Database → Data → Start collection。
3. Collection ID 填 `profiles`。
4. Document ID 貼上管理員的 User UID。
5. 新增欄位：
   - `role`（string）：`admin`
   - `displayName`（string）：管理員顯示名稱
   - `email`（string）：管理員登入 Email

Firebase Console 的管理操作不受用戶端安全規則限制，因此可用這一步建立第一位管理員。

## 2. 發布安全規則

將專案根目錄的 `firestore.rules` 全文貼到 Firestore Database → Rules，按 Publish。

規則發布後：

- 訪客只能讀取 `publicBookings`、`publicConfig`。
- 訪客只能新增（不能讀取）`applications` 與 `feedback`。
- 夥伴只能讀取自己的 profile 與 `staffViews/{自己的 UID}/bookings`。
- 管理員可以管理完整場次、申請、財務、人員與設定。
- 舊版 `appData` 只允許管理員讀取，以便進行一次性遷移。

## 3. 部署新版網站並遷移舊資料

1. 部署此安全改版。
2. 用管理員帳號登入。
3. 進入「夥伴帳號」。
4. 按「開始轉移舊資料」。
5. 確認公開月曆、待確認申請、金額總覽都已恢復。

遷移只會複製資料，不會刪除舊版 `appData`。

## 4. 建立約 20 位夥伴帳號

每位夥伴：

1. Firebase Console → Authentication → Users → Add user。
2. 填寫夥伴的 Email 和暫時密碼。
3. 複製建立後的 User UID。
4. 網站管理後台 →「夥伴帳號」。
5. 填寫姓名、Email、User UID 後儲存。

儲存時，系統會依「姓名完全相同」把既有場次綁定到該 UID，並建立只包含該夥伴自己薪資的個人資料副本。

## 5. 驗收

- 無痕視窗：可看公開場況；看不到聯絡方式、租金、薪資；可送出申請。
- 夥伴 A：只能看到 A 的場次與 A 的薪資。
- 夥伴 B：不能看到 A 的場次與薪資。
- 管理員：可看到全部資料並正常編輯。
- 嘗試以未列入 `profiles` 的 Authentication 帳號登入：應被拒絕。

## 6. 穩定後清理

確認新版穩定並另外備份後，才考慮刪除舊版 `appData/staff-directory`（內含舊明碼查詢密碼）及其他舊版文件。

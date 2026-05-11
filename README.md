# ⚙️ Ta-Cash Backend | Secure MFS API Engine

[![Live API](https://img.shields.io/badge/Live-API-blue?style=for-the-badge&logo=vercel)](https://ta-cash-server.vercel.app)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![JWT](https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)

The **Ta-Cash Backend** is the high-performance core of the Ta-Cash Mobile Financial Service. It provides a secure, RESTful API architecture built on Node.js and Express, with MongoDB as the primary data store. It handles everything from encrypted transactions to complex admin analytics and real-time system management.

---

## 🛠️ Core Functionalities

### 🔐 Authentication & Security
- **JWT-based Auth**: Secure stateless authentication for all protected routes.
- **PIN Security**: Advanced Bcrypt hashing for transaction PINs.
- **Middleware Guard**: Multi-layered verification for user tokens and admin roles.

### 💸 Transaction Management
- **Atomic Operations**: Securely handles Send Money, Cash-In, and Cash-Out.
- **Fee Calculation**: Automated logic for transaction fees and revenue generation.
- **Tiers & Limits**: Dynamic calculation of daily spending limits based on user status.

### 📊 Admin & System
- **Real-time Stats**: Aggregated analytics for revenue, user growth, and transaction volume.
- **Maintenance Mode**: Global system toggle with admin bypass.
- **Audit Logging**: Immutable tracking of all administrative actions.
- **User Moderation**: API for approving agents, blocking users, and managing roles.

### 📁 Utilities
- **Image Proxy**: Secure image upload handling via Multer and ImgBB integration.
- **Notification Engine**: Backend logic for generating system, transaction, and message alerts.

---

## 📡 Key API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/register` | Register new User or Agent |
| **POST** | `/login` | Authenticate user and receive JWT |
| **POST** | `/sendMoney` | Perform P2P transfer (with PIN verification) |
| **POST** | `/cashOut` | Withdraw funds via Agent |
| **GET** | `/admin/revenue-stats` | Get historical revenue data (Admin Only) |
| **GET** | `/admin/audit-logs` | Retrieve system audit logs (Admin Only) |
| **PATCH** | `/admin/toggle-maintenance` | Toggle system-wide maintenance mode |

---

## 🚀 Installation & Local Development

### 1. Prerequisites
- Node.js (v16+)
- MongoDB Atlas URI
- ImgBB API Key

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
PORT=5000
DB_USER=your_db_username
DB_PASS=your_db_password
ACCESS_TOKEN_SECRET=your_jwt_secret
IMGBB_KEY=your_imgbb_api_key
```

### 3. Run the Server
```bash
npm install
npm start
```

---

## 📦 Database Collections
- `Users`: Central user registry with roles, balance, and tiers.
- `history`: Comprehensive transaction ledger.
- `notifications`: Real-time user alert storage.
- `auditLogs`: Administrative activity logs.
- `systemConfig`: Global application configuration.

---

## 👨‍💻 Author
**Tanveer Ahmed**
- [GitHub Profile](https://github.com/TanveerAhmed4545)

---
*Built for stability, security, and scale.*

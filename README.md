# CollEra - College Student Networking Platform 🎓

CollEra is India's premier college student networking platform. Connect with students from IITs, NITs, IIITs, and colleges across India. Build your network, collaborate on projects, and grow together.

![CollEra Banner](https://via.placeholder.com/1200x400/667eea/ffffff?text=CollEra+-+Connect+with+Every+College+Student+in+India)

## 🌟 Features

- **Verified Profiles**: Only students with valid `.edu.in`, `.ac.in`, or `.edu` emails can join
- **Email Verification**: Secure verification through Nodemailer with beautiful email templates
- **Smart Matching**: Find students with similar interests, skills, and goals
- **Connection System**: Send, accept, and manage connection requests
- **Beautiful UI**: Modern, responsive design with smooth animations and transitions
- **Real-time Status**: See who's online in your network

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Email**: Nodemailer with Gmail SMTP
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Styling**: Custom CSS with CSS Variables, Gradients, and Animations

## 📁 Project Structure

```
CollEra/
├── package.json           # Root scripts for running the app
├── README.md
├── .gitignore
│
├── backend/               # Backend (Node.js/Express)
│   ├── server.js          # Main server file
│   ├── package.json       # Backend dependencies
│   ├── .env               # Environment variables
│   ├── .env.example       # Environment template
│   ├── models/
│   │   └── User.js        # User model
│   ├── routes/
│   │   ├── auth.js        # Authentication routes
│   │   ├── users.js       # User routes
│   │   └── connections.js # Connection routes
│   ├── middleware/
│   │   └── auth.js        # JWT middleware
│   └── utils/
│       └── emailService.js # Email utilities
│
└── frontend/              # Frontend (HTML/CSS/JS)
    ├── package.json       # Frontend config
    ├── index.html         # Landing page
    ├── dashboard.html     # User dashboard
    ├── verification-success.html
    ├── verification-failed.html
    ├── css/
    │   ├── style.css      # Main styles
    │   └── dashboard.css  # Dashboard styles
    └── js/
        ├── app.js         # Main JavaScript
        └── dashboard.js   # Dashboard JavaScript
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Gmail account for sending emails

### Installation

1. **Clone the repository**
   ```bash
   cd CollEra
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   cd backend && npm install
   
   # Or from root
   npm run install:backend
   ```

3. **Set up environment variables**
   ```bash
   cd backend
   cp .env.example .env
   ```

4. **Configure your `.env` file**
   ```env
   PORT=3000
   NODE_ENV=development
   
   # MongoDB (use your connection string)
   MONGODB_URI=mongodb://localhost:27017/collera
   
   # JWT Secret (generate a secure random string)
   JWT_SECRET=your_super_secret_key_here
   JWT_EXPIRES_IN=7d
   
   # Email Configuration (Gmail)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_specific_password
   
   # App URL
   APP_URL=http://localhost:3000
   DOMAIN=collera.in
   ```

5. **Gmail App Password Setup**
   - Go to your Google Account settings
   - Enable 2-Step Verification
   - Go to Security > App passwords
   - Generate a new app password for "Mail"
   - Use this password in `EMAIL_PASS`

6. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

7. **Run the development server**
   ```bash
   # From root directory
   npm run dev
   
   # Or from backend directory
   cd backend && npm run dev
   ```

8. **Open your browser**
   ```
   http://localhost:3000
   ```

## 📧 Email Configuration

CollEra uses Nodemailer to send verification emails. The emails include:

- **Verification Email**: Beautiful HTML template with verification link
- **Welcome Email**: Sent after successful verification
- **Password Reset**: Secure password reset functionality

## 🌐 Deployment to collera.in

### Option 1: Deploy to Railway/Render/Heroku

1. Push your code to GitHub
2. Connect your repository to Railway/Render/Heroku
3. Set environment variables in the dashboard
4. Configure your domain (collera.in) in DNS settings:
   - Add CNAME record pointing to your deployment URL

### Option 2: Deploy to VPS (DigitalOcean/AWS)

1. **SSH into your server**
   ```bash
   ssh root@your-server-ip
   ```

2. **Install Node.js and MongoDB**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs mongodb
   ```

3. **Clone and setup**
   ```bash
   git clone https://github.com/yourusername/collera.git
   cd collera
   npm install
   ```

4. **Setup PM2 for process management**
   ```bash
   npm install -g pm2
   pm2 start server.js --name collera
   pm2 startup
   pm2 save
   ```

5. **Setup Nginx reverse proxy**
   ```nginx
   server {
       listen 80;
       server_name collera.in www.collera.in;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

6. **Setup SSL with Certbot**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d collera.in -d www.collera.in
   ```

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/verify/:token` - Verify email
- `POST /api/auth/resend-verification` - Resend verification email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users (with filters)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/profile` - Update profile
- `GET /api/users/suggestions/smart` - Get smart suggestions

### Connections
- `GET /api/connections` - Get all connections
- `GET /api/connections/pending` - Get pending requests
- `GET /api/connections/sent` - Get sent requests
- `POST /api/connections/request/:userId` - Send request
- `POST /api/connections/accept/:userId` - Accept request
- `POST /api/connections/reject/:userId` - Reject request
- `DELETE /api/connections/:userId` - Remove connection

## 🎨 Customization

### Colors
Edit CSS variables in `public/css/style.css`:

```css
:root {
    --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    --accent-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    --primary: #667eea;
    --secondary: #764ba2;
}
```

### Valid College Emails
Edit the validation patterns in `routes/auth.js`:

```javascript
const validPatterns = [
    /\.edu\.in$/,
    /\.ac\.in$/,
    /\.edu$/,
    // Add more patterns
];
```

## 📱 Responsive Design

CollEra is fully responsive and works on:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

## 🔒 Security Features

- Password hashing with bcrypt
- JWT-based authentication
- HTTP-only cookies
- Input validation and sanitization
- Protected API routes
- Email domain verification

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

- Website: [collera.in](https://collera.in)
- Email: support@collera.in

---

Made with ❤️ for Indian College Students

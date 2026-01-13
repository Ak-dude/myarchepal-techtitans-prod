# MyArchepal - Tech Titans

A modern web and mobile application built with React, TypeScript, and Python FastAPI backend.

## Project Structure

```
myarchepal-techtitans-prod/
├── backend/              # Python FastAPI backend
│   ├── app/
│   │   ├── api/         # API routes
│   │   ├── core/        # Configuration
│   │   ├── services/    # Business logic
│   │   └── main.py      # FastAPI app
│   ├── requirements.txt # Python dependencies
│   └── README.md        # Backend documentation
├── src/                 # React frontend source
├── public/              # Static assets
├── docs/                # Project documentation
├── android/             # Android mobile app
├── ios/                 # iOS mobile app
└── package.json         # Node.js dependencies
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Git

### Setup (First Time)

1. Install all dependencies:
```bash
npm install
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

Or use the automated setup script:
```bash
# Windows
setup.bat

# macOS/Linux
./setup.sh
```

2. Configure environment variables:
```bash
cp .env.example .env.local
cd backend
cp .env.example .env
cd ..
```

Edit `.env.local` with your Firebase configuration and `backend/.env` with your Azure OpenAI credentials.

### Running the Application

**Single command to start both frontend and backend:**
```bash
npm run dev
```

This will start:
- Frontend at http://localhost:5173
- Backend API at http://localhost:8000
- API Documentation at http://localhost:8000/docs

**Or run them separately:**
```bash
# Terminal 1 - Frontend only
npm run dev:frontend

# Terminal 2 - Backend only
npm run dev:backend
```

## Available Scripts

### Development

- `npm run dev` - Start both frontend and backend servers concurrently
- `npm run dev:frontend` - Start frontend only (Vite dev server)
- `npm run dev:backend` - Start backend only (FastAPI server)

### Frontend

- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Mobile (Capacitor)

- `npm run ios` - Build and open iOS app
- `npm run android` - Build and open Android app
- `npm run cap:sync` - Sync web assets to mobile

## Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Radix UI** - Component library
- **React Router** - Routing
- **Firebase** - Authentication & database
- **Capacitor** - Mobile framework

### Backend
- **FastAPI** - Python web framework
- **Uvicorn** - ASGI server
- **Pydantic** - Data validation
- **Azure OpenAI** - AI services

## Features

- User authentication with Firebase
- Responsive design for web and mobile
- Secure backend API with Azure OpenAI integration
- Cross-platform mobile apps (iOS & Android)
- Modern UI with Radix UI components

## Security

- Environment variables for sensitive data
- Backend proxy for API keys (Azure OpenAI)
- Firebase security rules
- CORS configuration
- Input validation with Pydantic

See [SECURITY.md](SECURITY.md) for more details.

## Documentation

- [Backend API Documentation](backend/README.md)
- [Mobile App Setup](docs/mobile_app.md)
- [iOS App Setup](docs/mobile_app_apple.md)
- [Responsive Design](docs/responsive.md)
- [Todo List](docs/Todo.md)
- [Security Audit](SECURITY_AUDIT_REPORT.md)

## Development Workflow

1. Make changes to frontend code in `src/`
2. Backend changes go in `backend/app/`
3. Test locally with both servers running
4. Commit changes following conventional commits
5. Push to your branch and create a pull request

## Production Deployment

### Frontend (Vercel/Netlify)
1. Build the app: `npm run build`
2. Deploy the `dist/` folder
3. Set environment variables in the hosting platform

### Backend
1. Deploy to a Python hosting service (Render, Railway, Fly.io, etc.)
2. Set environment variables securely
3. Update `VITE_BACKEND_API_URL` in frontend to point to production backend

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

Private project - Tech Titans

## Support

For issues and questions, please open a GitHub issue.

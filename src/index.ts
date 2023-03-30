// -> This must come first
// Registers all import aliases.
import './aliases'

// -> This must come second
// Injects all variables in .env file.
import '@/env'

// -> Test .env
console.log(process.env.TEST, 'from .env')

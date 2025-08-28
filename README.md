# Party Registration & Social Network Management System

I used AI to write nearly the entire thing, and so of course I let it also write most of the README:

A comprehensive event registration and social network analysis platform built for managing party registrations while tracking and analyzing social connections between attendees. This system combines traditional event management with advanced social network mapping to optimize seating arrangements and enhance guest experiences.

## Overview

This application serves as a sophisticated party registration system that goes beyond simple RSVP management. It collects detailed information about attendees including their social connections, language preferences, and conversation topics, so you can use this data to create optimal seating arrangements that maximize social interaction and comfort.

### Key Features

- **🎫 Smart Registration System**
  - Tiered invitation system with priority-based seating allocation
  - Real-time capacity management
  - Comprehensive attendee information collection (dietary preferences, language skills, interests)

- **🕸️ Social Network Analysis**
  - Relationship mapping between attendees using familiarity scales
  - Language compatibility tracking for conversation optimization
  - Interest-based matching for topic discussions
  - Algorithm-driven seating assignments based on social connections

- **💳 Integrated Payment Processing**
  - Swish payment integration for seamless transactions
  - Mobile and desktop payment options
  - Automatic cost calculations including alcohol preferences

- **📊 Administrative Dashboard**
  - Real-time registration statistics and tier management
  - Capacity monitoring across different invitation tiers
  - Social network visualization and analysis tools
  - Export capabilities for research and planning

- **🔒 Privacy & Research Features**
  - Optional anonymized data collection for research purposes
  - GDPR-compliant data handling
  - Configurable consent management

## Use Cases

This system is particularly valuable for:
- **Academic Events**: PhD defenses, conferences, and research gatherings where social networking is crucial
- **Professional Networking**: Corporate events, industry meetups, and professional development gatherings
- **Social Gatherings**: Parties where optimizing guest interactions enhances the overall experience
- **Research Applications**: Social network analysis studies and behavioral research

## Technical Architecture

Built on a modern full-stack architecture using:

- **Frontend**: React + React Router + ShadCN UI
  - Responsive design with mobile-first approach
  - Accessible UI components with Tailwind CSS
  - Real-time form validation and user feedback

- **Backend**: Hono on Cloudflare Workers
  - Edge computing for global performance
  - RESTful API endpoints for registration management
  - Social network data processing and analysis

- **Deployment**: Cloudflare Workers via Wrangler
  - Worldwide edge deployment for low-latency access
  - Automatic scaling and high availability
  - Integrated CDN for static assets

## Getting Started

It should be possible to get this set up by just cloning the repository, and then creating a new worker in Cloudflare based on that repository. I have never tried that, though, so some finagling of details may be needed. I offer no support in this, consult your nearest ChatGPT for help with this process.

## Configuration

### Event Details
Edit `app/content/home.ts` to customize:
- Event title, date, and location
- Party description and details
- Form fields and validation messages
- Payment instructions

### Seating Management
Configure `app/config/seats.ts` to set up:
- Priority tiers and seat allocations
- Invitation code mapping
- Capacity limits per tier

### Payment Setup
Update `app/config/payment.ts` with:
- Swish payment details
- Cost calculations
- Payment instructions


## Contributing

If you have a nice idea for something to improve, feel free to drop a pull request on me. Or just branch off the entire thing and keep developing it on your own.

## License

Copyleft - do whatever you like with it. AI wrote 95% of the code anyway, so what authorship claim do I have?

## Support

For technical support or feature requests, please open an issue in the repository.

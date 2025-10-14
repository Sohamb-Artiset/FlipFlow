
# FlipFlow: Interactive PDF to Flipbook Conversion

## Introduction

FlipFlow is a Software-as-a-Service (SaaS) platform that transforms static PDF documents into engaging, interactive, and web-based digital flipbooks. Our objective is to provide an intuitive and powerful tool for marketers, content creators, and businesses to present their documents in a mobile-friendly format with realistic page-turning animations. This platform serves as a modern alternative to existing solutions like Heyzine, FlipHTML5, and Flipsnack, offering customization, sharing, and analytics.

## Target Audience

  * **Digital Marketers:** Creating interactive brochures, catalogs, and reports.
  * **Small to Medium Businesses (SMBs):** Presenting portfolios, menus, and corporate documents.
  * **Educators & Students:** Sharing presentations, research papers, and assignments in an engaging format.
  * **Content Creators & Publishers:** Distributing digital magazines, e-books, and comics.

## Key Features

  * **PDF to Flipbook Conversion:** Seamlessly upload your PDF files and watch them transform into interactive flipbooks.
  * **Interactive Flipbook Viewer:** A smooth, realistic page-flip animation experience. The viewer also supports zooming and navigation to specific pages.
  * **Customization and Branding:** Add your company logo and customize the background color or image to match your brand's aesthetic. You can also embed YouTube/Vimeo videos and audio clips.
  * **Sharing and Embedding:** Share your flipbooks via a direct public URL or embed them on your website using an `iframe` code. You can also download your flipbook for offline viewing.
  * **Analytics:** Track the total number of views and reads for each flipbook directly from your dashboard.
  * **Responsive Design:** Your flipbooks will be fully responsive and viewable on desktops, tablets, and mobile devices.
  * **User Dashboard:** A centralized dashboard to manage all your flipbooks with complete CRUD (Create, Read, Update, Delete) operations.

## Technical Stack

### Frontend:

  * **Framework:** React.js
  * **Flipbook Engine:** `react-pageflip`
  * **UI/UX Animations:** Framer Motion
  * **PDF Processing (Client-side):** `pdfjs-dist`
  * **UI Components:** Shadcn UI, Radix UI

### Backend as a Service (BaaS):

  * **Provider:** Supabase
      * **Authentication:** Manages user accounts and sessions.
      * **Database:** Stores user data and flipbook configurations.
      * **Storage:** Hosts uploaded PDF files and generated assets.

### Custom Server-side Logic:

  * **Runtime:** Node.js
  * **Framework:** Express.js (for handling offline downloads and advanced server tasks)

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

  * Node.js and npm (or your preferred package manager)
  * Supabase account and a new project created.

### Installation

1.  **Clone the repo:**
    ```sh
    git clone https://github.com/sohamb-artiset/flipflow.git
    ```
2.  **Install NPM packages:**
    ```sh
    npm install
    ```
3.  **Set up Supabase:**
      * You will need to manually create two storage buckets in your Supabase dashboard:
          * **Bucket 1: `flipbook-pdfs`**
              * **Public:** Yes (public)
              * **File size limit:** 100MB
              * **Allowed MIME types:** `application/pdf`
          * **Bucket 2: `flipbook-assets`**
              * **Public:** Yes (public)
              * **File size limit:** 5MB
              * **Allowed MIME types:** `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`
      * Run the SQL from `supabase/migrations/20250111000000_setup_storage_buckets.sql` in your Supabase SQL editor to set up the storage policies.
4.  **Generate Supabase types:**
      * Install the Supabase CLI:
        ```sh
        npm install -g supabase
        ```
      * Generate types from your database schema (replace `<your-project-id>` with your actual project ID):
        ```sh
        supabase gen types typescript --project-id <your-project-id> > src/integrations/supabase/types.ts
        ```
5.  **Start the development server:**
    ```sh
    npm run dev
    ```

## Usage

  * **For Users:**

    1.  **Sign up/Login:** Use the authentication system to create an account or log in.
    2.  **Upload PDF:** In your dashboard, click "Create Flipbook" and drag and drop your PDF file.
    3.  **Customize:** Edit the title, description, colors, and upload a logo for branding.
    4.  **Share:** Get a public URL to share your flipbook.
    5.  **View Analytics:** See view counts and other basic analytics in your dashboard.

  * **For Developers:**

      * `/dashboard`: Manage flipbooks.
      * `/flipbook/:id`: Public viewing of a flipbook.
      * `/flipbook/:id/edit`: Customize a specific flipbook.

## Known Limitations

  * **Large PDFs:** Very large PDFs (\>50MB) may cause performance issues on the client-side.
  * **Mobile Performance:** Heavy PDFs may be slow on mobile devices.
  * **Storage Costs:** PDF storage can become expensive with a large number of users.
  * **Client-Side Processing:** All PDF processing currently happens on the client-side.

## Future Enhancements

1.  **Server-side PDF Processing:** Convert PDFs to images on upload for better performance.
2.  **Advanced Analytics:** Implement page-level analytics and engagement metrics.
3.  **Embedding:** Provide `iframe` embed codes for websites.
4.  **Offline Downloads:** Allow users to download self-contained HTML packages of their flipbooks.
5.  **Team Collaboration:** Enable multiple users to collaborate on flipbooks.
6.  **Advanced Customization:** Add more branding options and themes.

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Project Link: [https://github.com/sohamb-artiset/flipflow](https://www.google.com/search?q=https://github.com/sohamb-artiset/flipflow)
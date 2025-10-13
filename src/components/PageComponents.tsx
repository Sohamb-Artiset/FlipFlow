import React from 'react';

interface PageProps {
  pageData: {
    imageData: string;
    width: number;
    height: number;
  };
  backgroundColor?: string;
  logoUrl?: string;
  pageNumber: number;
}

// Hard cover component with data-density="hard" attribute
export const PageCover = React.forwardRef<HTMLDivElement, PageProps>(
  ({ pageData, backgroundColor = '#ffffff', logoUrl, pageNumber }, ref) => {
    return (
      <div 
        ref={ref}
        className="flipbook-page"
        data-density="hard"
        style={{
          backgroundColor,
          backgroundImage: logoUrl ? `url(${logoUrl})` : undefined,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'top right',
          backgroundSize: '100px auto',
          padding: '20px',
        }}
      >
        <img
          src={pageData.imageData}
          alt={`Page ${pageNumber}`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
          draggable={false}
        />
      </div>
    );
  }
);

PageCover.displayName = 'PageCover';

// Regular flexible page component
export const Page = React.forwardRef<HTMLDivElement, PageProps>(
  ({ pageData, backgroundColor = '#ffffff', logoUrl, pageNumber }, ref) => {
    return (
      <div 
        ref={ref}
        className="flipbook-page"
        style={{
          backgroundColor,
          backgroundImage: logoUrl ? `url(${logoUrl})` : undefined,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'top right',
          backgroundSize: '100px auto',
          padding: '20px',
        }}
      >
        <img
          src={pageData.imageData}
          alt={`Page ${pageNumber}`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
          draggable={false}
        />
      </div>
    );
  }
);

Page.displayName = 'Page';
const ContentPage = require('../models/ContentPageModel');
const mongoose = require('mongoose');
const { logAdminAction } = require('./adminLogService'); // Import admin logger

// Predefined page keys for initialization
const predefinedPageKeys = [
  { pageKey: 'faq', title: 'Frequently Asked Questions', content: '<p>Placeholder FAQ content. Please edit.</p>' },
  { pageKey: 'terms', title: 'Terms and Conditions', content: '<p>Placeholder Terms and Conditions. Please edit.</p>' },
  { pageKey: 'provably-fair-info', title: 'Provably Fair Information', content: '<p>Placeholder Provably Fair information. Please edit.</p>' },
  { pageKey: 'about-us', title: 'About Us', content: '<p>Placeholder About Us content. Please edit.</p>' },
  { pageKey: 'privacy-policy', title: 'Privacy Policy', content: '<p>Placeholder Privacy Policy content. Please edit.</p>' },
];

const listAllContentPages = async () => {
  const pages = await ContentPage.find({}).select('pageKey title updatedAt lastUpdatedBy').populate('lastUpdatedBy', 'username');
  return pages;
};

const getContentPage = async (pageKey) => {
  const page = await ContentPage.findOne({ pageKey }).populate('lastUpdatedBy', 'username');
  return page;
};

const updateContentPage = async (pageKey, title, content, adminUserId) => {
  const page = await ContentPage.findOne({ pageKey });
  if (!page) {
    // Optionally, create if not exists, or throw error.
    // For this setup, we assume pages are pre-defined or created via a separate mechanism if dynamic creation is needed.
    // throw new Error(`Content page with key '${pageKey}' not found.`);
    // Let's try to create it if it's one of the predefined keys that somehow wasn't initialized.
     const predefined = predefinedPageKeys.find(p => p.pageKey === pageKey);
     if (predefined) {
         console.warn(`Content page ${pageKey} not found, creating from predefined template.`);
         const newPage = new ContentPage({
             pageKey,
             title: title || predefined.title,
             content: content || predefined.content,
             lastUpdatedBy: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : null,
         });
         await newPage.save();
         return newPage;
     } else {
         throw new Error(`Content page with key '${pageKey}' not found and is not a predefined page.`);
     }
  }

  if (title) page.title = title;
  if (content) page.content = content;
  page.lastUpdatedBy = adminUserId ? new mongoose.Types.ObjectId(adminUserId) : null;
  
  await page.save();

  await logAdminAction(
    adminUserId,
    'Admin', // Placeholder for adminUsername
    'CONTENT_PAGE_UPDATED',
    'content_page',
    pageKey,
    { title: page.title, oldContent: page.content, newContent: content } // Log relevant changes
    // Be cautious about logging very large content directly. Maybe log a summary or diff indicator.
  );

  return page;
};

const initializeDefaultContentPages = async () => {
  console.log('Initializing default content pages...');
  for (const pageData of predefinedPageKeys) {
    try {
      let page = await ContentPage.findOne({ pageKey: pageData.pageKey });
      if (!page) {
        page = new ContentPage({
          pageKey: pageData.pageKey,
          title: pageData.title,
          content: pageData.content,
          // lastUpdatedBy can be null for initial system setup
        });
        await page.save();
        console.log(`Initialized default content page: ${pageData.pageKey}`);
      } else {
        console.log(`Content page ${pageData.pageKey} already exists. Skipping initialization.`);
      }
    } catch (error) {
      console.error(`Error initializing content page ${pageData.pageKey}:`, error);
    }
  }
  console.log('Default content pages initialization complete.');
};

module.exports = {
  listAllContentPages,
  getContentPage,
  updateContentPage,
  initializeDefaultContentPages,
};

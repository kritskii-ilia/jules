const adminContentService = require('../services/adminContentService'); // Re-use service for fetching

const getPublicContentPage = async (req, res) => {
  try {
    const { pageKey } = req.params;
    // Fetch only specific fields needed for public display, excluding sensitive ones like lastUpdatedBy if desired.
    const page = await adminContentService.getContentPage(pageKey.toLowerCase()); 
    
    if (!page) {
      return res.status(404).json({ message: `Content page with key '${pageKey}' not found.` });
    }
    
    // Return a subset of fields for public consumption
    res.json({
        pageKey: page.pageKey,
        title: page.title,
        content: page.content,
        updatedAt: page.updatedAt,
        createdAt: page.createdAt,
    });
  } catch (error) {
    console.error(`Error fetching public content page ${req.params.pageKey}:`, error);
    res.status(500).json({ message: error.message || 'Error fetching content page.' });
  }
};

module.exports = {
  getPublicContentPage,
};

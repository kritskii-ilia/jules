const adminContentService = require('../services/adminContentService');

const listAllContentPages = async (req, res) => {
  try {
    const pages = await adminContentService.listAllContentPages();
    res.json(pages);
  } catch (error) {
    console.error('Error listing content pages:', error);
    res.status(500).json({ message: 'Error listing content pages.' });
  }
};

const getContentPage = async (req, res) => {
  try {
    const { pageKey } = req.params;
    const page = await adminContentService.getContentPage(pageKey.toLowerCase());
    if (!page) {
      return res.status(404).json({ message: `Content page with key '${pageKey}' not found.` });
    }
    res.json(page);
  } catch (error) {
    console.error(`Error fetching content page ${req.params.pageKey}:`, error);
    res.status(500).json({ message: error.message || 'Error fetching content page.' });
  }
};

const updateContentPage = async (req, res) => {
  try {
    const { pageKey } = req.params;
    const { title, content } = req.body;
    const adminUserId = req.user.id; // From adminProtect middleware

    if (!title && !content) { // Check if at least one is provided
      return res.status(400).json({ message: 'Title or content must be provided for update.' });
    }
     if (title && typeof title !== 'string') {
        return res.status(400).json({ message: 'Invalid title format.' });
    }
    if (content && typeof content !== 'string') {
        return res.status(400).json({ message: 'Invalid content format.' });
    }


    const updatedPage = await adminContentService.updateContentPage(pageKey.toLowerCase(), title, content, adminUserId);
    res.json({ message: `Content page '${pageKey}' updated successfully.`, page: updatedPage });
  } catch (error) {
    console.error(`Error updating content page ${req.params.pageKey}:`, error);
    res.status(error.message.includes('not found') ? 404 : 500).json({ message: error.message || 'Error updating content page.' });
  }
};

module.exports = {
  listAllContentPages,
  getContentPage,
  updateContentPage,
};

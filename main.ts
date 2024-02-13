import { App, Editor, MarkdownView, TFile, Modal, Notice, Plugin } from 'obsidian';

export default class ImageCollectorPlugin extends Plugin {
    async onload() {
        // Register a command that can be called via the command palette
        // This command will operate on the currently active file
        this.addCommand({
            id: 'export-markdown-images',
            name: 'Export markdown images',
            callback: () => {
                // Obtain the current active file
                const activeFile = this.app.workspace.getActiveFile();
                // Check if there's an active file and it's a markdown file
                if (activeFile && activeFile instanceof TFile && activeFile.extension === 'md') {
                    // Call the export function with the active file
                    this.exportMarkdownImages(activeFile);
                } else {
                    new Notice('No active markdown file.');
                }
            },
        });

        // Listen for context menu events on files to add custom action
        this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
            // Ensure the file is a Markdown file before adding the menu item
            if (file instanceof TFile && file.extension === 'md') {
                menu.addItem((item) => {
                    item.setTitle("Export images")
                        .setIcon("document-export")
                        .onClick(() => {
                            // Execute the plugin's functionality for the selected file
                            this.exportMarkdownImages(file);
                        });
                });
            }
        }));
    }

    async exportMarkdownImages(file: TFile) {
        const fileContent = await this.app.vault.read(file);
        const imageRegex = /!\[\[?(.*?)\]?\]/g;
        let match;
        const images = [];

        while ((match = imageRegex.exec(fileContent)) !== null) {
            const imagePath = match[1].includes('|') ? match[1].split('|')[0] : match[1];
            images.push(imagePath);
        }

        if (images.length === 0) {
            new Notice('No images found in the markdown file.');
            return;
        }

        const targetFolderName = `${file.basename} images`;
        await this.app.vault.createFolder(targetFolderName).catch(() => {});

        for (const imagePath of images) {
            const imageFile = this.app.metadataCache.getFirstLinkpathDest(imagePath, file.path);

            if (imageFile instanceof TFile) {
                try {
                    const imageContent = await this.app.vault.readBinary(imageFile);
                    const targetPath = `${targetFolderName}/${imageFile.name}`;
                    await this.app.vault.createBinary(targetPath, imageContent);
                    new Notice(`Exported ${imageFile.name} to ${targetPath}`);
                } catch (error) {
                    new Notice(`Failed to export image ${imageFile.name}: ${error}`);
                    console.error(`Failed to export image ${imageFile.name}:`, error);
                }
            } else {
                new Notice(`Image not found: ${imagePath}`);
                console.error(`Image not found: ${imagePath}`);
            }
        }
    }
}

import { App, Editor, MarkdownView, TFile, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface ImageCollectorPluginSettings {
    imageFolderPath: string;
}

const DEFAULT_SETTINGS: ImageCollectorPluginSettings = {
    imageFolderPath: 'zAttachments', // Default folder
};

class ImageCollectorSettingTab extends PluginSettingTab {
    plugin: ImageCollectorPlugin;

    constructor(app: App, plugin: ImageCollectorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Image Collector'});

        new Setting(containerEl)
            .setName('Image folder path')
            .setDesc('The folder where images are stored')
            .addText(text => text
                .setPlaceholder('Enter your image folder path')
                .setValue(this.plugin.settings.imageFolderPath)
                .onChange(async (value) => {
                    this.plugin.settings.imageFolderPath = value;
                    await this.plugin.saveSettings();
                }));
    }
}

export default class ImageCollectorPlugin extends Plugin {
    settings: ImageCollectorPluginSettings;

    async onload() {
		await this.loadSettings();
	
		// Register a command that can be called via the command palette
		// This command will operate on the currently active file
		this.addCommand({
			id: 'export-markdown-images',
			name: 'Export Markdown Images',
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
	
		// Add setting tab for plugin settings
		this.addSettingTab(new ImageCollectorSettingTab(this.app, this));
	
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
	
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	
	async saveSettings() {
		await this.saveData(this.settings);
	}
	
    async exportMarkdownImages(file: TFile) {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== 'md') {
			new Notice('No active markdown file.');
			return;
		}
	
		const fileContent = await this.app.vault.read(activeFile);
		// Updated regex to match both Markdown and Obsidian embed syntax
		const imageRegex = /!\[\[?(.*?)\]?\]/g;
		let match;
		const images = [];
	
		while ((match = imageRegex.exec(fileContent)) !== null) {
			// Handle different image paths (external links, Obsidian embeds)
			const imagePath = match[1].includes('|') ? match[1].split('|')[0] : match[1]; // Handle potential alt text in Obsidian embeds
			images.push(imagePath);
		}
	
		if (images.length === 0) {
			new Notice('No images found in the markdown file.');
			return;
		}
	
		const targetFolderName = `${activeFile.basename} images`;
		await this.app.vault.createFolder(targetFolderName).catch(() => {});
	
		// Inside your exportMarkdownImages function, after resolving image paths
		for (const imagePath of images) {
			const resolvedImagePath = this.resolveImagePath(activeFile, imagePath);
			const imageFile = this.app.vault.getAbstractFileByPath(resolvedImagePath);
			
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
				new Notice(`Image not found: ${resolvedImagePath}`);
				console.error(`Image not found: ${resolvedImagePath}`);
			}
		}

	}
	
	resolveImagePath(activeFile: TFile, imagePath: string): string {
		let normalizedPath = imagePath.replace(/\[\[|\]\]/g, ''); // Remove the [[ ]] if present
	
		// Directly use the settings for the base image folder path instead of hardcoding 'zAttachments'
		let basePath = this.settings.imageFolderPath;
	
		// If the path is absolute or already starts with the basePath, return it as is
		if (normalizedPath.startsWith('/') || normalizedPath.startsWith(`${basePath}/`)) {
			return normalizedPath;
		}
	
		// Construct a path relative to the active file's directory if the file has a parent
		if (activeFile.parent) {
			const folderPath = activeFile.parent.path;
			const fullPath = `${folderPath}/${normalizedPath}`;
	
			// Check if the file exists at this fullPath
			const fileExists = this.app.vault.getAbstractFileByPath(fullPath);
			if (fileExists) {
				return fullPath;
			}
		}
	
		// Fallback to using basePath if the file wasn't found relative to the active file
		return `${basePath}/${normalizedPath}`;
	}
	
}

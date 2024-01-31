import { log } from 'console';
import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface DueTaskSetting {
	keyWord: string;
	shortTasks: string; //Name of subroot folder
	activeTasks: string; //Name of child foloder
	dailyTasks: string; //Name of autocomplite file 
	onlySeven: string;  
	debtTask: string;
	active1to7: boolean;
	message: string;
	plusDayWeek: number;
	lockWeek: boolean;
	lockDisplay: boolean;
}

const DEFAULT_SETTINGS: DueTaskSetting = {
	keyWord: "",
	shortTasks: "Short Duration Folder",
	activeTasks: "Active Task Folder",
	dailyTasks: "Daily Tasks",
	onlySeven: "Task for the week",
	debtTask: "Debt Tasks",
	active1to7: false,
	message: "'Time Left':",
	plusDayWeek: 1,
	lockWeek: false,
	lockDisplay: false

}

export default class DueTaskAssistant extends Plugin {
	settings: DueTaskSetting;
	 async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'create-dir-command',
			name: 'Create Directories',
			callback: async () => {
				await this.loadData();
				const files = this.app.vault.getMarkdownFiles();
				const onlySevenID = files.findIndex(onlySevenName => {
					return onlySevenName.name === this.settings.onlySeven+".md";
				});
				if (onlySevenID == -1) {
					this.createDir(this.settings.shortTasks, this.settings.activeTasks, this.settings.debtTask, this.settings.onlySeven);
				}
				else {
					const currentTime = new Date().getTime();
					const previusTime = files[onlySevenID].stat.ctime;
					const currentDay = new Date(currentTime).getDay();
					const currentMonth = new Date(currentTime).getMonth();
					const currentYear = new Date(currentTime).getFullYear();
					const previusDay = new Date(previusTime).getDay();
					const previusMonth = new Date(previusTime).getMonth();
					const previusYear = new Date(previusTime).getFullYear()
					const reduceTime = new Date(currentYear-previusYear, currentMonth-previusMonth, currentDay-previusDay).getDay();
					const deadLine = this.settings.plusDayWeek-reduceTime;
					const content = await this.app.vault.cachedRead(files[onlySevenID]);
					if (content.contains(this.settings.message) == true) {
						const contentSplited = content.split(content.slice(content.indexOf(this.settings.message), this.settings.keyWord.length+this.settings.message.length+2), this.settings.keyWord.length);
						const changeValue = content.replace(contentSplited[1][0], deadLine.toString());
						this.app.vault.modify(files[onlySevenID],changeValue);
					}
					else {
						this.app.vault.modify(files[onlySevenID],this.settings.keyWord+"\n"+this.settings.message+" "+this.settings.plusDayWeek+"\n"+content);
					}
				}
			}
		});

		this.addCommand({
			id: 'toggle-week-Tasks-command',
			name: 'Toggle week durations due',
			callback: async () => {
				if (this.settings.active1to7 == true) {
					this.settings.active1to7 = false;
					await this.saveSettings();
				}
				else {
					this.settings.active1to7 = true;
					await this.saveSettings();
				}
			}
		});

		var checkPeriod =  await this.compareLimitTime(this.settings.onlySeven);

		this.app.workspace.on("file-open", async () => {
			this.settings.lockDisplay = false;
			checkPeriod = await this.compareLimitTime(this.settings.onlySeven);
			if (this.settings.active1to7 == true) {
				if (checkPeriod == true) {
					this.settings.active1to7 = false;
					await this.saveSettings();
					this.moveWeekTask(this.settings.shortTasks, this.settings.activeTasks, this.settings.debtTask, this.settings.onlySeven);
				}
			}
			this.saveSettings();
		});
		
		this.addSettingTab(new DueTaskSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	
	async saveSettings() {
		await this.saveData(this.settings);
	}

 	async compareLimitTime(onlySeven: string) {
		const message = this.settings.message;
		const daymmSec = 86400000; //day  in milliseconds
		const files = this.app.vault.getMarkdownFiles();
		const currentTime = new Date().getTime();
		const onlySevenID = files.findIndex(onlySevenName => {
			return onlySevenName.name === onlySeven+".md";
		});

		if(onlySevenID == -1) {
			return false;
		}
		else {
			var deadLine;
			const previusTime = files[onlySevenID].stat.ctime;
			const previusHour = new Date(previusTime).getHours();
			const previusDay = new Date(previusTime).getDay();
			const previusMonth = new Date(previusTime).getMonth();
			const previusYear = new Date(previusTime).getFullYear();
			const beforeNextDay = daymmSec/(60*60*1000)-previusHour; //Hours
			const setTime = new Date(previusYear, previusMonth, previusDay, beforeNextDay).getTime();
			const reduceTime = Math.floor((currentTime-setTime)/(24*60*60*1000))%24-1
			if (this.settings.plusDayWeek - reduceTime < 0) {
				deadLine = 0;
			}
			else{
				deadLine = this.settings.plusDayWeek-reduceTime;
			}
			if (this.settings.lockDisplay == false) {
				const content = await this.app.vault.cachedRead(files[onlySevenID]);
				if (content.contains(message) == true) {
					var contentSplited = content.split(content.slice(content.indexOf(this.settings.message), this.settings.keyWord.length+this.settings.message.length+2), this.settings.keyWord.length);
					var changeValue = content.replace(contentSplited[1][0],(this.settings.plusDayWeek-deadLine).toString());
					this.app.vault.modify(files[onlySevenID],changeValue);
				}
				else {
					this.app.vault.modify(files[onlySevenID],this.settings.keyWord+"\n"+this.settings.message+" "+(this.settings.plusDayWeek-deadLine).toString()+"\n"+content);
				}
				this.settings.lockDisplay = true;
				await this.saveSettings();
			}
			const nextTime = (previusTime-setTime)+( this.settings.plusDayWeek*daymmSec);
			if (currentTime > setTime+nextTime) {
				this.settings.lockWeek = false;
				await this.saveSettings(); 
				return true;
			}
			else {
				this.settings.lockWeek = true;
				await this.saveSettings();
				return false;
			}
		}
	}

	createDir(shortTasks: string, activeTasks: string, debtTasks: string, onlySeven: string) {
		const keyWord = this.settings.keyWord;
		const message = this.settings.message;
		const daysLeft = this.settings.plusDayWeek+1;
		const folderShort = this.app.vault.getAbstractFileByPath(shortTasks);
		const folderActive = this.app.vault.getAbstractFileByPath(shortTasks+'/'+activeTasks);
		const fileDebt = this.app.vault.getAbstractFileByPath(shortTasks+'/'+activeTasks+'/'+debtTasks+".md");
		const fileOnlySeven = this.app.vault.getAbstractFileByPath(shortTasks+'/'+activeTasks+'/'+onlySeven+".md");

		if (folderShort == null) {
			this.app.vault.createFolder(shortTasks);
			this.app.vault.createFolder(shortTasks+'/'+activeTasks);
			this.app.vault.create(shortTasks+'/'+activeTasks+'/'+debtTasks+".md", "");
			if (this.settings.active1to7 == true) {
				this.app.vault.create(shortTasks+'/'+activeTasks+'/'+onlySeven+".md", keyWord+"\n"+message+" "+daysLeft);
			}
			return;
		}
		else {
			if (folderActive == null) {
				this.app.vault.createFolder(shortTasks+'/'+activeTasks);
				this.app.vault.create(shortTasks+'/'+activeTasks+'/'+debtTasks+".md", "");
				if (this.settings.active1to7 == true) {
					this.app.vault.create(shortTasks+'/'+activeTasks+'/'+onlySeven+".md", keyWord+"\n"+message+" "+daysLeft);
				}
				return;
			}
			else {
				if(fileDebt == null) {
					this.app.vault.create(shortTasks+'/'+activeTasks+'/'+debtTasks+".md", "");
				}
				if(fileOnlySeven == null && this.settings.active1to7 == true) {
					this.app.vault.create(shortTasks+'/'+activeTasks+'/'+onlySeven+".md", keyWord+"\n"+message+" "+daysLeft);
				}
			}
		}
	}

	async moveWeekTask(shortTasks: string, activeTasks: string, debtTasks: string, onlySeven: string) {
		const folderShort = this.app.vault.getAbstractFileByPath(shortTasks);
		const folderActive = this.app.vault.getAbstractFileByPath(shortTasks+'/'+activeTasks);
		const files = this.app.vault.getMarkdownFiles();
		var debtID = files.findIndex(debtName => {
			return debtName.name === debtTasks+".md";
		});

		var onlySevenID = files.findIndex(onlySevenName => {
			return onlySevenName.name === onlySeven+".md";
		});
		if(folderShort == null || folderActive == null || debtID == -1 || onlySevenID == -1) {
			return;
		}
		else {
			const content = await this.app.vault.cachedRead(files[onlySevenID]);
			this.app.vault.append(files[debtID], "\r\n"+ content);
			this.app.vault.delete(files[onlySevenID]);	
		}
	}
}

class DueTaskSettingTab extends PluginSettingTab {
	plugin: DueTaskAssistant;

	constructor(app: App, plugin: DueTaskAssistant) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		new Setting(containerEl)
			.setName("Files Identifier")
			.setDesc("example: #'something', key word.")
			.addText(text => text
				.setPlaceholder('File Identifier')
				.setValue(this.plugin.settings.keyWord)
				.onChange(async (value) => {
					this.plugin.settings.keyWord = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Name sub root")
			.setDesc("Names of the directories.")
			.addText(text => text
				.setPlaceholder('Sub Root')
				.setValue(this.plugin.settings.shortTasks)
				.onChange(async (value) => {
					this.plugin.settings.shortTasks = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName("Name sub folder")
			.setDesc("Names of the directories.")
			.addText(text => text
				.setPlaceholder('Sub folder')
				.setValue(this.plugin.settings.activeTasks)
				.onChange(async (value) => {
					this.plugin.settings.activeTasks = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
		.setName("Name debt due notes")
		.setDesc("Names of the directories.")
		.addText(text => text
			.setPlaceholder('Debt dues')
			.setValue(this.plugin.settings.debtTask)
			.onChange(async (value) => {
				this.plugin.settings.debtTask = value;
				await this.plugin.saveSettings();
			}));
		
		new Setting(containerEl)
			.setName("Active 1-7 days")
			.setDesc("Activate the next functions.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.active1to7)
				.onChange(async (value) => {
					this.plugin.settings.active1to7 = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Name weekly due notes")
			.setDesc("Name note for due of seven days durations.")
			.addText(text => text
				.setPlaceholder('No more than 7 days')
				.setValue(this.plugin.settings.onlySeven)
				.onChange(async (value) => {
					this.plugin.settings.onlySeven = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
		.setName("Time Left message")
		.setDesc("Key word for searching and display the days before deathline.")
		.addText(text => text
			.setPlaceholder('Message')
			.setValue(this.plugin.settings.message)
			.onChange(async (value) => {
				this.plugin.settings.message = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
			.setName('No more than 7 days range')
			.setDesc("1 week time.")
			.addSlider(slider => slider
				.setDynamicTooltip()
				.setLimits(1,7,1)
				.setValue(this.plugin.settings.plusDayWeek)
				.onChange(async (value) => {
					this.plugin.settings.plusDayWeek = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
		.setName('Create')
		.setDesc("Add Directories on vault root")
		.addButton(onchange => onchange
			.onClick(async (MouseEvent) => {
				await this.plugin.loadSettings();
				this.plugin.createDir(this.plugin.settings.shortTasks, this.plugin.settings.activeTasks, this.plugin.settings.debtTask, this.plugin.settings.onlySeven);
				const files = this.app.vault.getMarkdownFiles();
				const onlySevenID = files.findIndex(onlySevenName => {
					return onlySevenName.name === this.plugin.settings.onlySeven+".md";
				});
				if (onlySevenID == -1) {
					this.plugin.createDir(this.plugin.settings.shortTasks, this.plugin.settings.activeTasks, this.plugin.settings.debtTask, this.plugin.settings.onlySeven);
				}
				else {
					const content = await this.app.vault.cachedRead(files[onlySevenID]);
					if(content.contains(this.plugin.settings.message) == true) {
						const currentTime = new Date().getTime();
						const previusTime = files[onlySevenID].stat.ctime;
						const currentDay = new Date(currentTime).getDay();
						const currentMonth = new Date(currentTime).getMonth();
						const currentYear = new Date(currentTime).getFullYear();
						const previusDay = new Date(previusTime).getDay();
						const previusMonth = new Date(previusTime).getMonth();
						const previusYear = new Date(previusTime).getFullYear()
						const reduceTime = new Date(currentYear-previusYear, currentMonth-previusMonth, currentDay-previusDay).getDay();
						const deadLine = this.plugin.settings.plusDayWeek-reduceTime;
						const contentSplited = content.split(content.slice(content.indexOf(this.plugin.settings.message), this.plugin.settings.keyWord.length+this.plugin.settings.message.length+2), this.plugin.settings.keyWord.length);
						const changeValue = content.replace(contentSplited[1][0], deadLine.toString());
						this.app.vault.modify(files[onlySevenID],changeValue);
					}
					else {
						this.app.vault.modify(files[onlySevenID],this.plugin.settings.message+" "+this.plugin.settings.plusDayWeek+"\n"+content);
					}
				}
			}));	
	};
}
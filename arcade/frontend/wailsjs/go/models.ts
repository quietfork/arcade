export namespace main {
	
	export class FileEntry {
	    name: string;
	    isDir: boolean;
	    isHidden: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FileEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.isDir = source["isDir"];
	        this.isHidden = source["isHidden"];
	    }
	}
	export class PaneSpec {
	    id: string;
	    projectId?: string;
	    title?: string;
	    command?: string;
	    args?: string[];
	    cwd?: string;
	
	    static createFrom(source: any = {}) {
	        return new PaneSpec(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.projectId = source["projectId"];
	        this.title = source["title"];
	        this.command = source["command"];
	        this.args = source["args"];
	        this.cwd = source["cwd"];
	    }
	}
	export class TreeNode {
	    type: string;
	    paneId?: string;
	    dir?: string;
	    ratio?: number;
	    a?: TreeNode;
	    b?: TreeNode;
	
	    static createFrom(source: any = {}) {
	        return new TreeNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.paneId = source["paneId"];
	        this.dir = source["dir"];
	        this.ratio = source["ratio"];
	        this.a = this.convertValues(source["a"], TreeNode);
	        this.b = this.convertValues(source["b"], TreeNode);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LayoutInput {
	    id: string;
	    name: string;
	    tree?: TreeNode;
	    panes: PaneSpec[];
	
	    static createFrom(source: any = {}) {
	        return new LayoutInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.tree = this.convertValues(source["tree"], TreeNode);
	        this.panes = this.convertValues(source["panes"], PaneSpec);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LayoutSnapshot {
	    id: string;
	    name: string;
	    tree?: TreeNode;
	    panes: PaneSpec[];
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new LayoutSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.tree = this.convertValues(source["tree"], TreeNode);
	        this.panes = this.convertValues(source["panes"], PaneSpec);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Project {
	    id: string;
	    name: string;
	    path: string;
	    command?: string;
	    args?: string[];
	    env?: Record<string, string>;
	    tags?: string[];
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    lastUsedAt?: any;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.path = source["path"];
	        this.command = source["command"];
	        this.args = source["args"];
	        this.env = source["env"];
	        this.tags = source["tags"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.lastUsedAt = this.convertValues(source["lastUsedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ProjectInput {
	    name: string;
	    path: string;
	    command?: string;
	    args?: string[];
	    env?: Record<string, string>;
	    tags?: string[];
	
	    static createFrom(source: any = {}) {
	        return new ProjectInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.command = source["command"];
	        this.args = source["args"];
	        this.env = source["env"];
	        this.tags = source["tags"];
	    }
	}
	export class ProjectStatus {
	    project: Project;
	    pathExists: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ProjectStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.project = this.convertValues(source["project"], Project);
	        this.pathExists = source["pathExists"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Settings {
	    theme: string;
	    fontFamily: string;
	    fontSize: number;
	    lineHeight: number;
	    defaultCommand: string;
	    defaultArgs: string[];
	    scrollback: number;
	    dangerousConsent: boolean;
	    proxyURL: string;
	    noProxy: string;
	    sidebarHidden: boolean;
	    activeView: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.theme = source["theme"];
	        this.fontFamily = source["fontFamily"];
	        this.fontSize = source["fontSize"];
	        this.lineHeight = source["lineHeight"];
	        this.defaultCommand = source["defaultCommand"];
	        this.defaultArgs = source["defaultArgs"];
	        this.scrollback = source["scrollback"];
	        this.dangerousConsent = source["dangerousConsent"];
	        this.proxyURL = source["proxyURL"];
	        this.noProxy = source["noProxy"];
	        this.sidebarHidden = source["sidebarHidden"];
	        this.activeView = source["activeView"];
	    }
	}

}


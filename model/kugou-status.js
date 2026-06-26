import Base from "./base.js";

export default class KugouStatusModel extends Base {
    constructor(e) {
        super(e);
        this.model = "kugou-status";
    }
    
    async getData(kugouStatusData) {
        return {
            ...this.screenData,
            saveId: "kugou-status",
            kugouStatusData,
        };
    }
}

module.exports = Columnizer;

function Columnizer(columns)
{
    this.columns = columns;
};

Columnizer.prototype.columnify = function columnify(d)
{
    this.logData = d;
    var maxLines = 0;
    var data = d.data;
    var lines = [];
    for(var i = 0; i < data.length; i++)
    {
        switch(typeof(data[i]))
        {
            case 'string':
            case 'number':
                break;
            case 'object':
                try {
                    var newData = JSON.stringify(data[i]);
                    data[i] = newData;
                }
                catch(e)
                {

                }
                break;
            case 'undefined':
                data[i] = '';
                break;
            default:
                data[i] = "Could not parse data of type " + typeof(data[i]);
        }

        lines = Math.ceil(data[i].toString().length/this.columns.cols[i]);
        maxLines = (lines > maxLines) ? lines : maxLines
    }
    var lines = [];
    for(var i = 0; i < data.length; i++)
    {
        var lineData = [];
        var extraChars = (maxLines * this.columns.cols[i]) - data[i].length + 1;
        data[i] = data[i] + Array(extraChars).join(' ');
        lineData = data[i].match(new RegExp('.{1,' + this.columns.cols[i] + '}', 'g'));
        lines.push(lineData);
    }
    lines.push(maxLines);
    return this.getLogLines(lines);
}

Columnizer.prototype.getLogLines = function (lineData)
{
    var line = "";
    var maxLines = lineData.pop();
    var logLines = '';
    for(l = 0; l < maxLines;l++)
    {
        var line = '';
        for(c = 0; c < this.columns.cols.length; c++)
        {
            line = (c < lineData.length) ? line + lineData[c][l] + Array(this.columns.padding).join(' ') : Array(this.columns.padding).join(' ');
      }
        logLines = logLines + ((this.columns.prefix && l ==0) ? this.columns.prefix : (this.columns.prefix && l > 0) ? Array(this.columns.prefix.length + 1).join(' ') : ' ') + line + (l < maxLines - 1 ? '\n' : '');
    }
    return logLines;
}